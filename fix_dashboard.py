path = "src/web/systemDashboard.js"
with open(path, "r", encoding="utf-8") as f:
    code = f.read()

# Si deseas que el generador no falle si falta algún slot, o asegurarnos de que la plantilla HTML tenga los slots, 
# vamos a actualizar el HTML que lee systemDashboard.js para que incluya {{active-ip}}
print("Verificando generador...")
