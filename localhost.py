import http.server

HandlerClass = http.server.SimpleHTTPRequestHandler

# Patch in the correct extensions
HandlerClass.extensions_map['.js'] = 'text/javascript'
HandlerClass.extensions_map['.mjs'] = 'text/javascript'
HandlerClass.extensions_map['.wgsl'] = 'text/javascript'
HandlerClass.extensions_map['.wasm'] = 'application/wasm'

# Run the server (like `python -m http.server` does)
http.server.test(HandlerClass, port=5000)