package httpkit

import (
	"io"
	"net/http"
)

// CopyStream forwards chunks as they arrive, including through instrumented writers.
func CopyStream(w http.ResponseWriter, source io.Reader) error {
	controller := http.NewResponseController(w)
	buffer := make([]byte, 4096)
	for {
		n, err := source.Read(buffer)
		if n > 0 {
			if _, writeErr := w.Write(buffer[:n]); writeErr != nil {
				return writeErr
			}
			if flushErr := controller.Flush(); flushErr != nil {
				return flushErr
			}
		}
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}
	}
}
