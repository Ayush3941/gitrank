package authkit

import (
	"crypto/hmac"
	"errors"
	"net/http"
	"strconv"
	"time"
)

const (
	ServiceReadTimestampHeader = "X-GitRank-Service-Timestamp"
	ServiceReadSignatureHeader = "X-GitRank-Service-Signature"
)

// SignServiceReadRequest authenticates a GET without exposing the session secret.
func SignServiceReadRequest(request *http.Request, secret []byte, now time.Time) error {
	if request == nil || request.URL == nil || request.Method != http.MethodGet || len(secret) == 0 {
		return errors.New("service read requires a GET request and signing secret")
	}
	timestamp := strconv.FormatInt(now.Unix(), 10)
	request.Header.Set(ServiceReadTimestampHeader, timestamp)
	request.Header.Set(ServiceReadSignatureHeader, encode(serviceReadSignature(request, secret, timestamp)))
	return nil
}

// VerifyServiceReadRequest accepts the active or retiring secret for one minute.
func VerifyServiceReadRequest(request *http.Request, secrets [][]byte, now time.Time) error {
	invalid := errors.New("invalid service read signature")
	if request == nil || request.URL == nil || request.Method != http.MethodGet {
		return invalid
	}
	timestamp := request.Header.Get(ServiceReadTimestampHeader)
	seconds, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return invalid
	}
	signedAt := time.Unix(seconds, 0)
	if signedAt.Before(now.Add(-time.Minute)) || signedAt.After(now.Add(time.Minute)) {
		return invalid
	}
	signature, err := decode(request.Header.Get(ServiceReadSignatureHeader))
	if err != nil {
		return invalid
	}
	for _, secret := range secrets {
		if len(secret) > 0 && hmac.Equal(signature, serviceReadSignature(request, secret, timestamp)) {
			return nil
		}
	}
	return invalid
}

func serviceReadSignature(request *http.Request, secret []byte, timestamp string) []byte {
	key := sign(secret, []byte("gitrank-service-read/v1"))
	return sign(key, []byte(request.Method+"\n"+request.URL.RequestURI()+"\n"+timestamp))
}
