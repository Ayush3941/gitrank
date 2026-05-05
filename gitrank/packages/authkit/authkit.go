package authkit

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/Ayush3941/gitrank/packages/contracts"
)

type Principal struct {
	Subject     string   `json:"subject"`
	GitHubLogin string   `json:"github_login,omitempty"`
	Roles       []string `json:"roles,omitempty"`
}

type StateClaims struct {
	Nonce     string    `json:"nonce"`
	ExpiresAt time.Time `json:"expires_at"`
}

type CookieConfig struct {
	Name     string
	Value    string
	Domain   string
	Path     string
	MaxAge   int
	HTTPOnly bool
	Secure   bool
	SameSite http.SameSite
	Expires  time.Time
}

type Authenticator func(ctx context.Context, token string) (*Principal, error)

func ContextWithPrincipal(ctx context.Context, principal Principal) context.Context {
	return context.WithValue(ctx, principalKey{}, principal)
}

func PrincipalFromContext(ctx context.Context) (Principal, bool) {
	principal, ok := ctx.Value(principalKey{}).(Principal)
	return principal, ok
}

func ParseBearerToken(header string) (string, error) {
	parts := strings.SplitN(strings.TrimSpace(header), " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || strings.TrimSpace(parts[1]) == "" {
		return "", errors.New("invalid bearer token")
	}
	return strings.TrimSpace(parts[1]), nil
}

func NewStateToken(secret []byte, nonce string, ttl time.Duration, now time.Time) (string, error) {
	if len(secret) == 0 {
		return "", errors.New("secret is required")
	}
	if strings.TrimSpace(nonce) == "" {
		return "", errors.New("nonce is required")
	}
	if ttl <= 0 {
		return "", errors.New("ttl must be positive")
	}

	claims := StateClaims{
		Nonce:     nonce,
		ExpiresAt: now.UTC().Add(ttl),
	}

	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}

	signature := sign(secret, payload)
	return encode(payload) + "." + encode(signature), nil
}

func ValidateStateToken(secret []byte, token string, now time.Time) (StateClaims, error) {
	var claims StateClaims

	if len(secret) == 0 {
		return claims, errors.New("secret is required")
	}

	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return claims, errors.New("invalid state token")
	}

	payload, err := decode(parts[0])
	if err != nil {
		return claims, err
	}
	signature, err := decode(parts[1])
	if err != nil {
		return claims, err
	}

	expected := sign(secret, payload)
	if !hmac.Equal(signature, expected) {
		return claims, errors.New("invalid state token signature")
	}

	if err := json.Unmarshal(payload, &claims); err != nil {
		return claims, err
	}
	if claims.ExpiresAt.Before(now.UTC()) {
		return claims, errors.New("state token expired")
	}

	return claims, nil
}

func NewOpaqueToken(size int) (string, error) {
	if size <= 0 {
		return "", errors.New("size must be positive")
	}
	raw := make([]byte, size)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func HashOpaqueToken(secret []byte, token string) (string, error) {
	if len(secret) == 0 {
		return "", errors.New("secret is required")
	}
	if strings.TrimSpace(token) == "" {
		return "", errors.New("token is required")
	}
	return encode(sign(secret, []byte(strings.TrimSpace(token)))), nil
}

func EncryptSecret(key []byte, plaintext string) (string, error) {
	if len(key) != 32 {
		return "", errors.New("encryption key must be 32 bytes")
	}
	if strings.TrimSpace(plaintext) == "" {
		return "", nil
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return "", err
	}
	sealed := gcm.Seal(nil, nonce, []byte(plaintext), nil)
	return base64.RawStdEncoding.EncodeToString(append(nonce, sealed...)), nil
}

func DecryptSecret(key []byte, ciphertext string) (string, error) {
	if len(key) != 32 {
		return "", errors.New("encryption key must be 32 bytes")
	}
	if strings.TrimSpace(ciphertext) == "" {
		return "", nil
	}

	raw, err := base64.RawStdEncoding.DecodeString(ciphertext)
	if err != nil {
		raw, err = base64.StdEncoding.DecodeString(ciphertext)
		if err != nil {
			return "", err
		}
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	if len(raw) < gcm.NonceSize() {
		return "", errors.New("ciphertext too short")
	}
	nonce := raw[:gcm.NonceSize()]
	payload := raw[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, payload, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

func DecodeBase64Key(value string) ([]byte, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, errors.New("key is required")
	}
	raw, err := base64.RawStdEncoding.DecodeString(value)
	if err != nil {
		raw, err = base64.StdEncoding.DecodeString(value)
		if err != nil {
			return nil, err
		}
	}
	if len(raw) != 32 {
		return nil, errors.New("decoded key must be 32 bytes")
	}
	return raw, nil
}

func DoubleSubmitCSRFFromToken(secret []byte, sessionToken string) (string, error) {
	return HashOpaqueToken(secret, sessionToken)
}

func SameSiteFromString(value string) http.SameSite {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "strict":
		return http.SameSiteStrictMode
	case "none":
		return http.SameSiteNoneMode
	default:
		return http.SameSiteLaxMode
	}
}

func SetCookie(w http.ResponseWriter, cfg CookieConfig) {
	path := cfg.Path
	if path == "" {
		path = "/"
	}
	http.SetCookie(w, &http.Cookie{
		Name:     cfg.Name,
		Value:    cfg.Value,
		Domain:   cfg.Domain,
		Path:     path,
		MaxAge:   cfg.MaxAge,
		HttpOnly: cfg.HTTPOnly,
		Secure:   cfg.Secure,
		SameSite: cfg.SameSite,
		Expires:  cfg.Expires,
	})
}

func ClearCookie(w http.ResponseWriter, name, domain string, secure bool, sameSite http.SameSite, httpOnly bool) {
	SetCookie(w, CookieConfig{
		Name:     name,
		Value:    "",
		Domain:   domain,
		Path:     "/",
		MaxAge:   -1,
		HTTPOnly: httpOnly,
		Secure:   secure,
		SameSite: sameSite,
		Expires:  time.Unix(0, 0).UTC(),
	})
}

func Bearer(authenticator Authenticator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token, err := ParseBearerToken(r.Header.Get("Authorization"))
			if err != nil {
				writeUnauthorized(w)
				return
			}

			principal, err := authenticator(r.Context(), token)
			if err != nil || principal == nil {
				writeUnauthorized(w)
				return
			}

			ctx := ContextWithPrincipal(r.Context(), *principal)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func sign(secret, payload []byte) []byte {
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write(payload)
	return mac.Sum(nil)
}

func encode(value []byte) string {
	return base64.RawURLEncoding.EncodeToString(value)
}

func decode(value string) ([]byte, error) {
	return base64.RawURLEncoding.DecodeString(value)
}

func writeUnauthorized(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_ = json.NewEncoder(w).Encode(contracts.NewErrorResponse("unauthorized", "authentication required", ""))
}

type principalKey struct{}
