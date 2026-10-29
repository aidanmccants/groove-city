import sys, os
from urllib.parse import quote
here = os.path.dirname(os.path.abspath(__file__))
tpl = open(os.path.join(here, 'template.html'), encoding='utf-8').read()
data = open(sys.argv[1], encoding='utf-8').read()
page = tpl.replace('/*__DATA__*/', data)
# fragment for publishing as an Artifact (the host adds doctype/head/body)
open(os.path.join(here, '..', 'artifact.html'), 'w', encoding='utf-8').write(page)
# favicon: a crimson voxel block with a pixel "G", inlined so the Worker serves no extra file
G = ['.XXXXX.', 'XX...XX', 'XX.....', 'XX.XXXX', 'XX...XX', 'XX...XX', '.XXXXX.']
px = ''.join(f'<rect x="{5 + c * 3}" y="{8 + r * 3}" width="3" height="3"/>'
             for r, row in enumerate(G) for c, ch in enumerate(row) if ch == 'X')
svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
       '<rect width="32" height="32" rx="5" fill="#a6192e"/><rect width="32" height="6" rx="3" fill="#5fa83a"/>'
       f'<g fill="#fff">{px}</g></svg>')
icon = '<link rel="icon" href="data:image/svg+xml,' + quote(svg) + '">'
# complete document for opening locally
head = ('<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + icon + '\n')
full = head + page.replace('<canvas id="view">', '</head><body>\n<canvas id="view">', 1) + '\n</body></html>\n'
out = os.path.join(here, '..', 'index.html')
open(out, 'w', encoding='utf-8').write(full)
print('wrote', os.path.normpath(out), os.path.getsize(out), 'bytes')
