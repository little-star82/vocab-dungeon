#!/usr/bin/env python3
"""把刺客（第二位隱藏勇者）組成遊戲用的 assets/Assassin.json。

刺客的模型是 KayKit Adventurers 1.0 的 Rogue_Hooded（戴兜帽的盜賊）。原檔 3.6 MB 裡有 76 個動作，
這裡只留遊戲用得到的那幾個，其他的動作資料整個拿掉。

來源（Kay Lousberg 的 KayKit，CC0）：
  https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
  addons/kaykit_character_pack_adventures/Characters/gltf/Rogue_Hooded.glb

用法：
  python3 tools/build_assassin.py <Rogue_Hooded.glb>

輸出的格式跟 assets/ 裡其他角色一樣：GLB 的 JSON 區塊，二進位資料用 base64 放在 buffers[0].uri。
"""
import base64, json, struct, sys
from pathlib import Path

# 前八個是所有勇者共用的，後面是刺客自己的（雙刀）
CLIPS = ['1H_Melee_Attack_Chop', '2H_Melee_Attack_Spin', 'Cheer', 'Death_A', 'Hit_A', 'Idle', 'Running_A', 'Spellcast_Shoot',
         'Dualwield_Melee_Attack_Chop', 'Dualwield_Melee_Attack_Stab', 'Dualwield_Melee_Attack_Slice', 'Dodge_Backward', 'Jump_Full_Short']
# 真正帶著模型動的骨頭。1.0 另外有一批 IK 控制骨，網頁上用不到，它們的動作資料不帶
DEFORM = {'root', 'hips', 'spine', 'chest', 'head',
          *(f'{b}.{s}' for s in 'lr' for b in ('upperarm', 'lowerarm', 'wrist', 'hand', 'handslot', 'upperleg', 'lowerleg', 'foot', 'toes'))}


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    b = Path(sys.argv[1]).read_bytes()
    assert b[:4] == b'glTF'
    jl = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    src = b[28 + jl:]

    anims = []
    for name in CLIPS:
        a = next(x for x in j['animations'] if x['name'] == name)
        chans = [c for c in a['channels'] if j['nodes'][c['target']['node']].get('name') in DEFORM]
        keep = sorted({c['sampler'] for c in chans})
        smap = {old: new for new, old in enumerate(keep)}
        anims.append({'name': name, 'samplers': [a['samplers'][i] for i in keep], 'channels': [{**c, 'sampler': smap[c['sampler']]} for c in chans]})
    j['animations'] = anims

    # 還用得到的 accessor：網格、蒙皮、留下來的動作
    used = set()
    for m in j['meshes']:
        for p in m['primitives']:
            used.update(p['attributes'].values())
            if 'indices' in p:
                used.add(p['indices'])
            for t in p.get('targets', []):
                used.update(t.values())
    for s in j['skins']:
        if 'inverseBindMatrices' in s:
            used.add(s['inverseBindMatrices'])
    for a in anims:
        for s in a['samplers']:
            used.update((s['input'], s['output']))
    amap = {old: new for new, old in enumerate(sorted(used))}

    # 重排二進位資料：只搬還用得到的 bufferView
    views = sorted({j['accessors'][i]['bufferView'] for i in used} | {im['bufferView'] for im in j.get('images', []) if 'bufferView' in im})
    vmap, out, new_views = {}, bytearray(), []
    for old in views:
        v = j['bufferViews'][old]
        while len(out) % 4:
            out.append(0)
        off = v.get('byteOffset', 0)
        new_views.append({**{k: v[k] for k in ('byteStride', 'target') if k in v}, 'buffer': 0, 'byteOffset': len(out), 'byteLength': v['byteLength']})
        out += src[off:off + v['byteLength']]
        vmap[old] = len(new_views) - 1
    while len(out) % 4:
        out.append(0)

    j['accessors'] = [{**j['accessors'][i], 'bufferView': vmap[j['accessors'][i]['bufferView']]} for i in sorted(used)]
    j['bufferViews'] = new_views
    for m in j['meshes']:
        for p in m['primitives']:
            p['attributes'] = {k: amap[v] for k, v in p['attributes'].items()}
            if 'indices' in p:
                p['indices'] = amap[p['indices']]
            if 'targets' in p:
                p['targets'] = [{k: amap[v] for k, v in t.items()} for t in p['targets']]
    for s in j['skins']:
        if 'inverseBindMatrices' in s:
            s['inverseBindMatrices'] = amap[s['inverseBindMatrices']]
    for a in anims:
        for s in a['samplers']:
            s['input'], s['output'] = amap[s['input']], amap[s['output']]
    for im in j.get('images', []):
        if 'bufferView' in im:
            im['bufferView'] = vmap[im['bufferView']]

    j['buffers'] = [{'byteLength': len(out), 'uri': 'data:application/octet-stream;base64,' + base64.b64encode(bytes(out)).decode()}]
    j['asset']['generator'] = 'tools/build_assassin.py (KayKit Adventurers 1.0 Rogue_Hooded)'
    dst = Path(__file__).resolve().parent.parent / 'assets/Assassin.json'
    dst.write_text(json.dumps(j, separators=(',', ':')))
    print(f'{dst}  {dst.stat().st_size // 1024} KB  動作 {len(anims)} 個  accessor {len(j["accessors"])} 個')


if __name__ == '__main__':
    main()
