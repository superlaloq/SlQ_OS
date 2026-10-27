path = "src/web/system-dashboard.html"
with open(path, "r", encoding="utf-8") as f:
    code = f.read()

# Reemplazamos posibles saltos de línea problemáticos en literales de cadena si los hubiera
# O simplemente escribimos una versión limpia sin quiebres en strings de JS.
print("Revisando y limpiando la plantilla...")
