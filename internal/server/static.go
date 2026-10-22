package server

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"
)

// EmbeddedAssets is populated when building release binaries.
//
//go:embed all:web_dist
var EmbeddedAssets embed.FS

// SPAHandler serves embedded files, routing unknown non-API routes to index.html.
type SPAHandler struct {
	fileSystem http.FileSystem
}

// NewSPAHandler initializes a Single Page Application file server.
func NewSPAHandler() http.Handler {
	sub, err := fs.Sub(EmbeddedAssets, "web_dist")
	if err != nil {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.NotFound(w, r)
		})
	}
	return &SPAHandler{fileSystem: http.FS(sub)}
}

func (h *SPAHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/")
	if path == "" {
		path = "index.html"
	}

	// Try serving exact file
	f, err := h.fileSystem.Open(path)
	if err == nil {
		_ = f.Close()
		http.FileServer(h.fileSystem).ServeHTTP(w, r)
		return
	}

	// Fallback to index.html for client-side routing
	indexFile, err := h.fileSystem.Open("index.html")
	if err == nil {
		_ = indexFile.Close()
		r.URL.Path = "/index.html"
		http.FileServer(h.fileSystem).ServeHTTP(w, r)
		return
	}

	http.Error(w, "Web UI assets not compiled yet. Run 'npm run build' in web/ directory.", http.StatusNotFound)
}
