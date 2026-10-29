import sys, os, json
from urllib.parse import quote
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.join(here, '..')
tpl = open(os.path.join(here, 'template.html'), encoding='utf-8').read()
data = open(sys.argv[1], encoding='utf-8').read()
# the game script: client/*.js joined in the order listed in client/order.json
order = json.load(open(os.path.join(root, 'client', 'order.json'), encoding='utf-8'))
code = ''.join(open(os.path.join(root, 'client', p), encoding='utf-8').read() for p in order)[:-1]
tpl = tpl.replace('/*__CLIENT__*/', code, 1)
page = tpl.replace('/*__DATA__*/', data)
# fragment for publishing as an Artifact (the host adds doctype/head/body)
open(os.path.join(root, 'artifact.html'), 'w', encoding='utf-8').write(page)
# favicon: a crimson voxel block with a pixel "G", inlined so the Worker serves no extra file
G = ['.XXXXX.', 'XX...XX', 'XX.....', 'XX.XXXX', 'XX...XX', 'XX...XX', '.XXXXX.']
px = ''.join(f'<rect x="{5 + c * 3}" y="{8 + r * 3}" width="3" height="3"/>'
             for r, row in enumerate(G) for c, ch in enumerate(row) if ch == 'X')
svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
       '<rect width="32" height="32" rx="5" fill="#a6192e"/><rect width="32" height="6" rx="3" fill="#5fa83a"/>'
       f'<g fill="#fff">{px}</g></svg>')
icon = '<link rel="icon" href="data:image/svg+xml,' + quote(svg) + '">'
head = ('<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' + icon + '\n')
doc = lambda p: head + p.replace('<canvas id="view">', '</head><body>\n<canvas id="view">', 1) + '\n</body></html>\n'
# complete single-file document for opening locally
out = os.path.join(root, 'index.html')
open(out, 'w', encoding='utf-8').write(doc(page))
print('wrote', os.path.normpath(out), os.path.getsize(out), 'bytes')
# the Worker's static assets: the page loads the map data as its own (cacheable) file
pub = os.path.join(root, 'worker', 'public')
os.makedirs(os.path.join(pub, 'maps'), exist_ok=True)
open(os.path.join(pub, 'maps', 'grove-city.js'), 'w', encoding='utf-8').write(data)
open(os.path.join(pub, 'index.html'), 'w', encoding='utf-8').write(
    doc(tpl.replace('<script>/*__DATA__*/</script>', '<script src="maps/grove-city.js"></script>')))
print('wrote', os.path.normpath(pub), 'index.html + maps/grove-city.js')
