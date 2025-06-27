package icon

import _ "embed"

// Data contains the embedded icon data from resource/image.png
//
//go:embed icon.png
var Data []byte

// DataICO contains the embedded icon data in ICO format for Windows
//
//go:embed icon.ico
var DataICO []byte