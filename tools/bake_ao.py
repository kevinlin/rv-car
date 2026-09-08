"""Bake isolated object AO into a packed shared atlas on UV2, never a lightmap.

Run with Blender -b model/rv.blend --python-exit-code 1 -P tools/bake_ao.py.
Only one object is visible to AO rays per bake. Atlas UVs stay with each object's geometry.
"""
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE/'tools'))
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.cycles.bake_type = 'AO'
scene.render.bake.use_clear = False
scene.render.bake.margin = 3
scene.render.bake.use_selected_to_active = False
scene.render.threads_mode = 'FIXED'
scene.render.threads = 8
objects = sorted((o for o in scene.objects if o.type == 'MESH'), key=lambda o:o.name)
side = math.ceil(math.sqrt(len(objects)))
resolution = 2048
old = bpy.data.images.get('rv_object_ao')
if old:
    bpy.data.images.remove(old)
image = bpy.data.images.new('rv_object_ao', width=resolution, height=resolution, alpha=False)
image.generated_color = (1,1,1,1)
image.colorspace_settings.name = 'Non-Color'

for index, obj in enumerate(objects):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    if obj.data.uv_layers.get('UV2'):
        obj.data.uv_layers.remove(obj.data.uv_layers['UV2'])
    uv = obj.data.uv_layers.new(name='UV2')
    obj.data.uv_layers.active = uv
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=.025)
    bpy.ops.object.mode_set(mode='OBJECT')
    # Edit-mode round trips invalidate Blender RNA layer references. Reacquire before access.
    uv = obj.data.uv_layers['UV2']
    for loop in uv.data:
        loop.uv = ((loop.uv.x*.94+.03+index%side)/side,
                   (loop.uv.y*.94+.03+index//side)/side)
    obj.data.uv_layers['UVMap'].active_render = True
    # Explicit bake target nodes on every used role, all write the same disjoint atlas.
    for mat in obj.data.materials:
        nodes = mat.node_tree.nodes
        node = nodes.get('AO bake target') or nodes.new('ShaderNodeTexImage')
        node.name = 'AO bake target'
        node.image = image
        nodes.active = node
    for other in objects:
        other.hide_render = other != obj
    bpy.ops.object.bake(type='AO', uv_layer='UV2')
    print(f'AO {index+1}/{len(objects)} {obj.name}', flush=True)

for obj in objects:
    obj.hide_render = False
    obj.data.uv_layers.active = obj.data.uv_layers['UVMap']
image.filepath_raw = str(HERE/'model/ao.png')
image.file_format = 'PNG'
image.save()
image.pack()
# glTF's documented custom Occlusion input exports an aoMap on TEXCOORD_1.
settings = bpy.data.node_groups.get('glTF Material Output') or bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree')
if not settings.interface.items_tree:
    settings.interface.new_socket(name='Occlusion',in_out='INPUT',socket_type='NodeSocketFloat')
for mat in bpy.data.materials:
    if mat.name in ['role.led.cove', 'role.body.led', 'role.glass', 'role.glass.tint']:
        continue
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    tex = nodes.get('AO bake target') or nodes.new('ShaderNodeTexImage')
    tex.name = 'AO bake target'
    tex.image = image
    uv = nodes.get('AO UV2') or nodes.new('ShaderNodeUVMap')
    uv.name = 'AO UV2'
    uv.uv_map = 'UV2'
    links.new(uv.outputs['UV'],tex.inputs['Vector'])
    output = nodes.get('AO export') or nodes.new('ShaderNodeGroup')
    output.name = 'AO export'
    output.node_tree = settings
    links.new(tex.outputs['Color'],output.inputs['Occlusion'])
pixels = np.empty(resolution*resolution*4,dtype=np.float32)
image.pixels.foreach_get(pixels)
values = pixels[::4]
assert np.isfinite(values).all() and values.max()-values.min()>.1, 'AO must contain real shading'
report={'type':'AMBIENT_OCCLUSION','isolatedObjects':True,'uv':'UV2','resolution':resolution,
        'objects':len(objects),'minimum':float(values.min()),'maximum':float(values.max()),
        'nonwhitePixels':int(np.count_nonzero(values<.98)),'atlas':'ao.png'}
(HERE/'model/ao-bake.json').write_text(json.dumps(report,indent=2)+'\n')
# Surface maps are no longer packed into the materials here: data/finishes.ts owns appearance
# now, and src/textures.ts resolves it at runtime. strip_surface_maps() unwires what earlier
# bakes left behind, so the .glb carries geometry and this AO atlas and nothing else.
from surface_textures import strip_surface_maps
strip_surface_maps()
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'model/rv.blend'))
print(json.dumps(report))
