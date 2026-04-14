# Geo-Time-Scale

## Purpose
快速查询地质年代表信息，包括宙、代、纪、世、期的完整层次结构。

## Usage
用户询问地质年代信息时使用此技能。

### 基本查询
```
/geo-time-scale [地质年代名称]
```

### 示例查询
- 查询"侏罗纪"：返回侏罗纪的时间范围、所属纪、包含的世等
- 查询"白垩纪"：返回白垩纪的时间范围、代表性化石群
- 查询"显生宙"：返回显生宙的起始时间、包含的代
- 查询"寒武纪"：返回寒武纪生命大爆发的相关信息

### 输出格式
```json
{
  "name": "罗纪",
  "name_en": "Jurassic",
  "start_ma": 201.4,
  "end_ma": 145.0,
  "duration": 56.4,
  "parent": "中生代",
  "children": ["早侏罗世", "中侏罗世", "晚侏罗世"],
  "description": "恐龙时代的主要时期之一，著名的恐龙包括梁龙、腕龙等..."
}
```

## Data Source
基于国际地质科学联合会 (ICS) 官方地质年代表。

## Examples

### Query: 泥盆纪
```
**泥盆纪 (Devonian)**

⏰ 时间范围: 419.2 - 358.9 Ma
📅 持续时间: 约 6030 万年
🌍 所属: 古生代

**包含世:**
- 早泥盆世 (Early Devonian): 419.2 - 382.7 Ma
- 中泥盆世 (Middle Devonian): 382.7 - 372.2 Ma
- 晚泥盆世 (Late Devonian): 372.2 - 358.9 Ma

**代表性化石:**
- 鱼类高度繁盛 (Age of Fishes)
- 早期两栖类出现
- 早期蕨类植物
- 腕足类、珊瑚礁

**著名事件:**
- 泥盆纪末大灭绝 (Late Devonian extinction)

**数据来源:** International Chronostratigraphic Chart v2023/2024
```

### Query: 显生宙
```
**显生宙 (Phanerozoic Eon)**

⏰ 时间范围: 538.8 Ma - 现在
📅 持续时间: 约 5.4 亿年

**包含代:**
- 古生代 (Paleozoic): 538.8 - 251.9 Ma
- 中生代 (Mesozoic): 251.9 - 66 Ma
- 新生代 (Cenozoic): 66 Ma - 现在

**特征:**
- 寒武纪生命大爆发 (Cambrian Explosion)
- 海洋无脊椎动物繁荣
- 脊椎动物登陆
- 恐龙时代
- 哺乳动物时代
- 人类出现

**数据来源:** International Chronostratigraphic Chart v2023/2024
```

## Notes
- 所有年代基于 2023/2024 年 ICS 官方标准
- Ma = Mega-annum (百万年前)
- 化石产地需要验证最新研究
