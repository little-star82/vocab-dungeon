#!/usr/bin/env python3
"""把弓箭手（隱藏勇者）組成遊戲用的 assets/Ranger.json。

弓箭手是 KayKit Adventurers 2.0 才有的角色，動作檔跟角色分開放，免費版又沒有攻擊動作；
1.0 版（專案其他四位勇者用的那一版）的動作齊全，而且兩版的骨架靜止姿勢完全一樣，
所以做法是：2.0 的弓箭手模型 ＋ 2.0 的弓和箭 ＋ 1.0 的動作，合成一個檔。

來源（都是 Kay Lousberg 的 KayKit，CC0）：
  2.0 免費版  https://kaylousberg.itch.io/kaykit-adventurers  （Free 2.0，解壓縮後的資料夾）
  1.0 的角色  https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
              addons/kaykit_character_pack_adventures/Characters/gltf/Rogue.glb（只拿裡面的動作）

用法：
  python3 tools/build_ranger.py <KayKit_Adventurers_2.0_FREE 資料夾> <1.0 的 Rogue.glb>

輸出的格式跟 assets/ 裡其他角色一樣：GLB 的 JSON 區塊，二進位資料用 base64 放在 buffers[0].uri。
"""
import base64, json, struct, sys
from pathlib import Path

# 要帶過來的動作：前八個是所有勇者共用的，後面是弓箭手自己的
CLIPS = ['1H_Melee_Attack_Chop', '2H_Melee_Attack_Spin', 'Cheer', 'Death_A', 'Hit_A', 'Idle', 'Running_A', 'Spellcast_Shoot',
         '2H_Ranged_Aiming', '2H_Ranged_Shoot', '1H_Ranged_Shoot', 'Jump_Full_Short', 'Dodge_Backward']
COMP = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
NUM = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read_glb(path):
    b = Path(path).read_bytes()
    assert b[:4] == b'glTF', path
    jl = struct.unpack('<I', b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    bl = struct.unpack('<I', b[20 + jl:24 + jl])[0]
    return j, b[28 + jl:28 + jl + bl]


def read_gltf(path):
    j = json.loads(Path(path).read_text())
    return j, (Path(path).parent / j['buffers'][0]['uri']).read_bytes()


class Target:
    """要寫出去的那個檔：一邊加東西，一邊把二進位資料接在後面"""

    def __init__(self, j, binary):
        self.j, self.bin = j, bytearray(binary)

    def add_bytes(self, data, **view):
        while len(self.bin) % 4:
            self.bin.append(0)
        self.j['bufferViews'].append({'buffer': 0, 'byteOffset': len(self.bin), 'byteLength': len(data), **view})
        self.bin += data
        return len(self.j['bufferViews']) - 1

    def node_index(self, name):
        return next(i for i, n in enumerate(self.j['nodes']) if n.get('name') == name)

    def add_static_mesh(self, src, src_bin, name, parent):
        """把一個單一網格的道具（弓、箭）接進來，掛在 parent 底下，材質用弓箭手自己的那張貼圖"""
        view_map = {}
        for i, v in enumerate(src['bufferViews']):
            extra = {k: v[k] for k in ('byteStride', 'target') if k in v}
            off = v.get('byteOffset', 0)
            view_map[i] = self.add_bytes(src_bin[off:off + v['byteLength']], **extra)
        acc_map = {}
        for i, a in enumerate(src['accessors']):
            self.j['accessors'].append({**a, 'bufferView': view_map[a['bufferView']]})
            acc_map[i] = len(self.j['accessors']) - 1
        mesh = json.loads(json.dumps(src['meshes'][0]))
        for p in mesh['primitives']:
            p['attributes'] = {k: acc_map[v] for k, v in p['attributes'].items()}
            if 'indices' in p:
                p['indices'] = acc_map[p['indices']]
            if 'targets' in p:
                p['targets'] = [{k: acc_map[v] for k, v in t.items()} for t in p['targets']]
            p['material'] = 0
        self.j['meshes'].append(mesh)
        self.j['nodes'].append({'name': name, 'mesh': len(self.j['meshes']) - 1})
        idx = len(self.j['nodes']) - 1
        self.j['nodes'][parent].setdefault('children', []).append(idx)
        return idx

    def add_animations(self, src, src_bin, names):
        """照骨頭名稱把動作接過來；這個模型沒有的骨頭（1.0 的 IK 控制骨）就跳過"""
        by_name = {n.get('name'): i for i, n in enumerate(self.j['nodes'])}
        acc_map = {}

        def accessor(i):
            if i not in acc_map:
                a = src['accessors'][i]
                v = src['bufferViews'][a['bufferView']]
                size = COMP[a['componentType']] * NUM[a['type']]
                start = v.get('byteOffset', 0) + a.get('byteOffset', 0)
                view = self.add_bytes(src_bin[start:start + size * a['count']])
                self.j['accessors'].append({k: a[k] for k in ('componentType', 'count', 'type', 'min', 'max', 'normalized') if k in a} | {'bufferView': view})
                acc_map[i] = len(self.j['accessors']) - 1
            return acc_map[i]

        out = self.j.setdefault('animations', [])
        for name in names:
            a = next(x for x in src['animations'] if x['name'] == name)
            samplers, channels, smap = [], [], {}
            for ch in a['channels']:
                node = by_name.get(src['nodes'][ch['target']['node']].get('name'))
                if node is None:
                    continue
                si = ch['sampler']
                if si not in smap:
                    s = a['samplers'][si]
                    samplers.append({'input': accessor(s['input']), 'output': accessor(s['output']), 'interpolation': s.get('interpolation', 'LINEAR')})
                    smap[si] = len(samplers) - 1
                channels.append({'sampler': smap[si], 'target': {'node': node, 'path': ch['target']['path']}})
            out.append({'name': name, 'samplers': samplers, 'channels': channels})

    def write(self, path):
        while len(self.bin) % 4:
            self.bin.append(0)
        self.j['buffers'] = [{'byteLength': len(self.bin), 'uri': 'data:application/octet-stream;base64,' + base64.b64encode(bytes(self.bin)).decode()}]
        self.j['asset']['generator'] = 'tools/build_ranger.py (KayKit Adventurers 2.0 Ranger + 1.0 animations)'
        Path(path).write_text(json.dumps(self.j, separators=(',', ':')))


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    pack, old_rogue = Path(sys.argv[1]), sys.argv[2]
    t = Target(*read_glb(pack / 'Characters/gltf/Ranger.glb'))
    assert len(t.j['materials']) == 1, '弓箭手應該只有一個材質'
    # 弓拿在左手；箭放在場景最上層，遊戲裡複製出來當飛出去的箭（平常藏起來）
    t.add_static_mesh(*read_gltf(pack / 'Assets/gltf/bow_withString.gltf'), 'Bow', t.node_index('handslot.l'))
    t.add_static_mesh(*read_gltf(pack / 'Assets/gltf/arrow_bow.gltf'), 'Arrow', t.j['scenes'][0]['nodes'][0])
    t.add_animations(*read_glb(old_rogue), CLIPS)
    out = Path(__file__).resolve().parent.parent / 'assets/Ranger.json'
    t.write(out)
    print(f'{out}  {out.stat().st_size // 1024} KB  動作 {len(t.j["animations"])} 個  節點 {len(t.j["nodes"])} 個')


if __name__ == '__main__':
    main()
