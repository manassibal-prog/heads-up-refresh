"""Builds Code.gs = Code.template.gs + Adit's SQL embedded (run after editing either file)."""
import pathlib
here = pathlib.Path(__file__).resolve().parent
t = (here / "Code.template.gs").read_text(encoding="utf-8")
sql = (here.parent / "pipeline" / "heads_up_call_list.sql").read_text(encoding="utf-8").rstrip()
for bad in ("`", "${", chr(92)):
    assert bad not in sql, "SQL contains " + repr(bad)
(here / "Code.gs").write_text(t.replace("/*SQL*/", sql), encoding="utf-8")
print("built Code.gs with", len(sql.splitlines()), "SQL lines")
