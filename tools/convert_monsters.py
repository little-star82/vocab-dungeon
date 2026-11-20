"""把 Quaternius 的「Cute Animated Monsters」從 FBX 轉成遊戲用的 GLB（assets/m/<名字>.glb）。

來源（Quaternius，CC0）：
  https://quaternius.com/packs/cutemonsters.html
  https://opengameart.org/content/textured-cute-monster-pack  （cute_animated_monsters_-_aug_2020.zip）

這支要用 Blender 跑（系統的 python 沒有 bpy）：
  /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --disable-autoexec \
      --python tools/convert_monsters.py -- "<解壓縮後的 Cute Animated Monsters - Aug 2020 資料夾>" [只轉這幾隻，用逗號分開]

每隻怪物：匯入 FBX → 貼圖縮成 512×512 → 連同所有動作匯出成一個 GLB（貼圖存成 JPEG）。
"""
import sys
from pathlib import Path

import bpy

args = sys.argv[sys.argv.index('--') + 1:]
pack = Path(args[0])
only = set(args[1].split(',')) if len(args) > 1 else None
out = Path(__file__).resolve().parent.parent / 'assets/m'
out.mkdir(parents=True, exist_ok=True)

for fbx in sorted((pack / 'FBX').glob('*.fbx')):
    name = fbx.stem
    if only and name not in only:
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(fbx))
    # FBX 裡記的貼圖路徑是作者電腦上的，這裡改指到包裡的 Textures 資料夾，再縮小
    tex = pack / 'Textures' / f'{name}_Texture.png'
    img = bpy.data.images.load(str(tex))
    img.scale(512, 512)
    for mat in bpy.data.materials:
        mat.use_nodes = True
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        bsdf = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not bsdf:
            continue
        for link in list(bsdf.inputs['Base Color'].links):
            links.remove(link)
        node = nodes.new('ShaderNodeTexImage')
        node.image = img
        links.new(node.outputs['Color'], bsdf.inputs['Base Color'])
        bsdf.inputs['Metallic'].default_value = 0
        bsdf.inputs['Roughness'].default_value = 0.85
    dst = out / f'{name}.glb'
    bpy.ops.export_scene.gltf(filepath=str(dst), export_format='GLB', export_animations=True, export_animation_mode='ACTIONS',
                              export_image_format='JPEG', export_jpeg_quality=82, export_yup=True, export_skins=True)
    print(f'CONVERTED {name} {dst.stat().st_size // 1024} KB actions={[a.name for a in bpy.data.actions]}')
