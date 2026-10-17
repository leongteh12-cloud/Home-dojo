# Turns docs/carers-guide.md into guide.js, which the app shows under 📖 Guide.
# Usage: python3 tools/build-guide.py   (run after editing the guide, then bump VERSION in sw.js)
import json, os
A = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
md = open(os.path.join(A, "docs/carers-guide.md")).read()
md = md.split("## Welcome", 1)[1]
open(os.path.join(A, "guide.js"), "w").write("// Generated from docs/carers-guide.md by tools/build-guide.py. Edit the .md, not this file.\nconst GUIDE_MD = " + json.dumps("## Welcome" + md, ensure_ascii=False) + ";\n")
