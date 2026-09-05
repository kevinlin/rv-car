"""Small seamless grayscale surface maps, multiplied by runtime finish colours."""
import math
from pathlib import Path
import bpy
import numpy as np


def add_surface_maps():
    folder = Path(__file__).resolve().parents[1] / 'model'
    n = 512
    y, x = np.mgrid[0:n, 0:n] / n
    grain = .83 + .10*np.sin(math.tau*(x*34+.6*np.sin(y*math.tau))) + .045*np.sin(math.tau*(x*117+.4*np.sin(y*math.tau*3)))
    # Rectangular parquet courses alternate orientation inside a repeating diagonal tile.
    u, v = (x+y)*16, (x-y)*16
    ix, iy = np.floor(u), np.floor(v)
    phase = np.mod(ix-iy, 8)
    horizontal = phase < 4
    a = np.where(horizontal, np.mod(u,1), np.mod(v,1))
    b = np.where(horizontal, np.mod(v+ix,4)/4, np.mod(u+iy,4)/4)
    seam = (a<.055)|(a>.945)|(b<.02)|(b>.98)
    floor = np.where(seam,.67,.90+.055*np.sin((u+v)*math.tau*17))
    cloth = .91+.045*np.cos(x*math.tau*128)*np.cos(y*math.tau*128)
    for label, pixels, roles in [('walnut_grain',grain,['wood.cabinet','wood.trim']),
                                 ('herringbone',floor,['floor']),
                                 ('woven_fabric',cloth,['textile.curtain'])]:
        image = bpy.data.images.get(label) or bpy.data.images.new(label,width=n,height=n,alpha=False)
        rgba = np.ones((n,n,4),dtype=np.float32)
        rgba[:,:,:3] = np.clip(pixels[:,:,None],0,1)
        image.pixels.foreach_set(rgba.ravel())
        image.filepath_raw = str(folder/(label+'.png'))
        image.file_format = 'PNG'
        image.save()
        image.pack()
        for role in roles:
            mat = bpy.data.materials['role.'+role]
            nodes, links = mat.node_tree.nodes, mat.node_tree.links
            tex = nodes.get('Surface grain') or nodes.new('ShaderNodeTexImage')
            tex.name = 'Surface grain'
            tex.image = image
            uv = nodes.get('Surface UV') or nodes.new('ShaderNodeUVMap')
            uv.name = 'Surface UV'
            uv.uv_map = 'UVMap'
            links.new(uv.outputs['UV'],tex.inputs['Vector'])
            # glTF supports image multiplied by a constant BaseColor factor. Keep Blender
            # tinted too; the runtime replaces that factor when a finish is selected.
            bsdf = nodes['Principled BSDF']
            mix = nodes.get('Finish tint') or nodes.new('ShaderNodeMixRGB')
            mix.name = 'Finish tint'
            mix.blend_type = 'MULTIPLY'
            mix.inputs[0].default_value = 1
            mix.inputs[2].default_value = bsdf.inputs['Base Color'].default_value
            links.new(tex.outputs['Color'],mix.inputs[1])
            links.new(mix.outputs[0],bsdf.inputs['Base Color'])
