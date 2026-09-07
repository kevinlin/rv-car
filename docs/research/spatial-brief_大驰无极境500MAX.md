Below is a ready-to-paste spatial brief for an agent that has never seen the RV.

One important caveat: current listings call the vehicle **大驰无极·境500MAX**, while detailed 2026 interior coverage often shortens the name to **境500**. The confirmed layout is 后上门 entry, a rear kitchen/bathroom service zone, a sliding partition, a central side-slide lounge, and a cab-over bed. 后上门 names where the door sits along the vehicle, not which wall it is in: the passenger door is in the **kerb (right) flank forward of the rear corner**, and the rear elevation is closed apart from a ventilation window over the kitchen worktop. Published dimensions include a **2200 × 1400 mm cab-over bed** and a **2000 × 1350 mm convertible sofa bed**. ([21RV][1])

I have not found an authoritative complete dimensioned floor plan for the 境500MAX. Its closely related 境280 predecessor uses essentially the same interior architecture and bed dimensions, and measures 5998 × 2450 × 3090 mm externally. Therefore, dimensions marked **ESTIMATED** below are useful for visualization or rough 3D reconstruction, but should not be treated as CAD/manufacturing dimensions. ([21RV][2])

## Agent-ready spatial description

```text
OBJECT:
DaChi (大驰) Wuji (无极) Jing 500 MAX, 2026-generation C-class motorhome.

PRIMARY DESIGN IDEA:
This is NOT a conventional RV with a side entrance next to the lounge.

It uses 后上门 entry: one passenger door in the KERB (RIGHT) FLANK,
forward of the rear corner. THE REAR ELEVATION IS CLOSED. Its only
opening is a ventilation window over the kitchen worktop.

You board at the rear of the vehicle, but from the side, so you cross
the cabin's width before you move forward at all.

CORE CIRCULATION, the movement the model has to support:

    door in the kerb flank, forward of the rear corner
        -> step in and cross leftward, along the vehicle's WIDTH
        -> at the washroom door on the off (left) flank, turn right,
           that is, toward the front
        -> through the kitchen/bath <-> lounge sliding partition
        -> central lounge, side slide-out

That path is an L. It is not a straight run down a corridor.

The interior is arranged as three consecutive zones along the vehicle's
longitudinal axis:

    REAR
      |
      v
[ Entry + Kitchen + Bathroom ]
              |
       sliding partition
              |
[       Main Lounge       ]
              |
[ Cab transition / cab ]
              |
[ Cab-over double bed ]
              |
            FRONT

The most important spatial feature is that the kitchen and bathroom form
a separate rear "service room". A real sliding partition separates this
wet/cooking zone from the lounge and sleeping zone.

The driver cab remains internally connected to the living compartment.
```

### Coordinate system

For any 2D or 3D model, use this convention:

```text
X axis: rear -> front
Y axis: vehicle left -> vehicle right
Z axis: floor -> roof

Origin:
rear-left corner of the habitation floor = (0, 0, 0)

Looking from above:

                  +X FRONT
                     ^
                     |
       LEFT +Y?      |       RIGHT
                     |
        rear wall / entrance
                     |
                   X = 0
```

For clarity, I would actually use:

```text
X = longitudinal position, 0 at rear, increasing toward front
Y = lateral position, 0 at vehicle centreline
    negative Y = left side
    positive Y = right side
Z = height above habitation floor
```

This avoids left/right ambiguity.

Positive Y, the right side, is the kerb side. It carries both the entry
door and the slide-out.

---

# 1. Overall 3D envelope

The exact 境500MAX body dimensions need manufacturer confirmation.

For a NON-ENGINEERING visualization, use approximately:

```text
Exterior length:   ~6000 mm       ESTIMATED
Exterior width:    ~2450 mm       ESTIMATED
Exterior height:   ~3100-3200 mm  ESTIMATED

Habitation inside clear width:
                   ~2250-2350 mm  ESTIMATED

Main standing interior height:
                   ~1950-2050 mm  ESTIMATED
```

Do not model the interior as a rectangular box all the way forward.

The front consists of:

```text
            __________________________ RV roof
           /        CAB-OVER BED       \
          /_____________________________\
                    open space
                above driver cab

              __________________
             |                  |
             |    driver cab    |
             |__________________|
```

The C-class over-cab structure projects above the Iveco cab and contains
the permanent main bed.

---

# 2. Top-down floor plan

Conceptually, the plan should look like this.

NOT TO EXACT SCALE:

```
                       车头
          ┌────────────────────────┐
          │         驾驶室          │
          │    ┌──────────────┐    │
          │    │   C型额头床   │    │
          │    │   2200×1400  │    │
          ├────┴──────────────┴────┤
          │                        │
          │ 会客区           侧拓展区 │
          │ 可收纳餐桌         抽拉床 │
          │ 双向座椅       2000×1350 │
          │                        │
          ├─────── 推拉隔断门 ───────┤
          │ ┌──────┐   ┌──────────┐│
          │ │ 冰箱 │    │高柜/微蒸烤││
          │ └──────┘   └──────────┘├────┐
          │ ┌───────┐ ↑ ②右转向车头 │ 门 │ ← 右后侧入门
          │ │ 卫浴   │ ← ①入门后向左├────┘   curb side
          │ │900×940│ ┌───────────┐│
          │ └───────┘ │工作台 / 水槽││
          └───────────┴───────────┴┘
                       车尾
```

````

The handing of this rear zone is fixed by owner feedback rather than
inferred: the door is in the kerb flank, the washroom pod sits on the
off flank against the partition, the worktop run backs onto the rear
wall and crosses the centreline with the fridge at its off end, and the
tall combi-oven cabinet stands on the kerb flank forward of the door.

Exact cabinet sizes are still undocumented; use the ESTIMATED values
below for those. Take the handing from the list above rather than
re-deriving it from photographs.

---

# 3. Longitudinal dimensions

A practical approximate decomposition of the <6 m vehicle is:

```text
REAR                                                     FRONT
0 mm                                                        ~6000

|--------|------------------|------------|---------------------|
 service      lounge         cab/front        engine/front
  zone          zone          transition          cab

 ~1200-       ~1900-2200
 1500 mm       mm
 ESTIMATED     ESTIMATED
````

For INTERIOR modeling, concentrate on approximately:

```text
Rear service zone:
    depth along X ≈ 1200-1500 mm      ESTIMATED

Main lounge:
    depth along X ≈ 2000 mm or slightly more
    This is strongly constrained by the 2000 mm-long sofa/bed.

Cab transition:
    open connection to driver/passenger cabin.

Cab-over bed:
    approximately 1400 mm deep along vehicle X
    and 2200 mm across vehicle width.
```

The last point follows from the published:

```text
CAB-OVER BED = 2200 × 1400 mm
```

In a C-class RV, the 2200 mm dimension runs approximately across the
vehicle, while the 1400 mm dimension runs front-to-back.

---

# 4. Main lounge, daytime configuration

The lounge is the largest visually open room.

Published layout:

```text
- Three individual adjustable automotive-style seats
- Seats can adjust fore/aft and backrest angle
- Wall-mounted/folding table
- Opposite side contains a long sofa
- Sofa converts into a bed
- Side-slide increases lounge floor width when parked
- Overhead storage cabinets
- Projector + retractable projection screen
- JBL audio
```

The agent should NOT imagine a conventional four-seat dinette with two
benches facing one another.

Think instead:

```text
SIDE A                                SIDE B

┌──────────────────┐            ┌──────────────────────┐
│                  │            │                      │
│   individual     │            │     LONG SOFA        │
│   seat           │            │                      │
│                  │            │                      │
│   individual     │            │                      │
│   seat           │            │                      │
│                  │            │                      │
│   individual     │            │                      │
│   seat           │            │                      │
│                  │            │                      │
└──────────────────┘            └──────────────────────┘

        foldable / wall-mounted table

            central walking aisle
```

The lounge feels substantially wider when the side slide is deployed.

Do not assume the slide-out dimension unless supplied separately.

---

# 5. Lounge, nighttime configuration

The long sofa transforms into:

```text
CONFIRMED BED SIZE:

2000 mm × 1350 mm
```

Conceptually:

```text
DAY

wall
┌──────────────────────────────┐
│      2000 mm LONG SOFA       │
└──────────────────────────────┘
          aisle


NIGHT

wall
┌──────────────────────────────┐
│                              │
│        2000 × 1350 BED       │
│                              │
└──────────────────────────────┘
          ^
          |
 bed extends farther into room
```

The 2000 mm dimension is approximately longitudinal.

The 1350 mm dimension extends laterally into the expanded lounge.

So the nighttime lounge loses much of its central open floor area.

This is the SECONDARY bed.

For two adults living in the vehicle permanently, the normal primary
bed is the cab-over bed.

---

# 6. Cab-over bedroom

This is a permanent elevated sleeping platform above the driver cab.

CONFIRMED mattress/platform size:

```text
width across vehicle:     2200 mm
depth front-to-back:      1400 mm
```

Top view:

```text
             LEFT <---- 2200 mm ----> RIGHT

             ┌──────────────────────┐
             │                      │
             │                      │
     1400    │      DOUBLE BED      │
      mm     │                      │
             │                      │
             └──────────────────────┘
                     CAB BELOW
```

Vertical relationship:

```text
             RV FRONT

           roof / cab-over shell
        __________________________
       /                          \
      /         MATTRESS           \
     /______________________________\
               2200 x 1400
                   ↑
              elevated bed

         open / access edge
     ____________________________
    |                            |
    |       DRIVER CAB           |
    | driver          passenger  |
    |____________________________|
```

Other known bedroom features:

```text
- breathable three-layer mattress
- privacy windows on both sides of cab-over section
- storage for pillows/bedding
```

The agent should represent this as a distinct mezzanine sleeping level,
not a floor-level bedroom.

---

# 7. Rear service room

This is the characteristic feature of this model.

Imagine entering a very small apartment through its kitchen/utility room
rather than directly into its living room.

Sequence:

```text
OUTSIDE, kerb side
   |
door in the kerb flank, forward of the rear corner
   |
   v
stand inside, facing the off flank:
   left hand, aft   -> worktop, basin, fridge, along the rear wall
   right hand, fwd  -> tall cabinet with the 3-in-1 combi oven,
                       against the kerb flank
   ahead            -> washroom pod, off flank, against the partition
   |
   v
cross the width to the washroom door, turn right toward the front
   |
sliding partition
   |
   v
main lounge
```

The rear wall carries no door. It is a closed elevation with one
ventilation window, sited over the worktop.

The worktop run crosses the centreline, so nothing walks past it. Aft
of the door there is a dead-end galley, not a corridor.

Approximate rear-zone footprint for rough visualization:

```text
vehicle width:       ~2250-2350 mm internal   ESTIMATED
front-to-back depth: ~1200-1500 mm            ESTIMATED
```

The kitchen and bathroom consume most of this footprint. What is left is
the width of floor immediately inside the door, plus the turn in front of
the washroom, and nothing else. There is no central corridor here.

The critical design principle is:

```text
COOKING + TOILET + SHOWER
          ||
          ||  closable partition
          \/
     MAIN LIVING ROOM
```

When the partition is closed, cooking fumes and bathroom moisture are
isolated from the main lounge/bedroom.

The 2026 sources explicitly describe this 后上门 entry, rear kitchen and
bathroom, followed by a sliding partition separating the service zone
from the lounge. Owner feedback puts that door in the kerb flank. ([Sohu][3])

---

# 8. Kitchen geometry

Model it primarily as a fixed built-in cabinet run rather than a free
standing kitchen island.

Known components:

```text
- integrated kitchen cabinetry
- deep sink
- swivelling water-saving faucet
- extendable worktop section
- extractor hood
- Toshiba microwave/steam/oven combination appliance
- 148 L Frost/Frost-style refrigerator
```

A useful rough cabinet depth for visualization is:

```text
counter depth ≈ 550-600 mm       ESTIMATED
counter height ≈ 850-900 mm      ESTIMATED
```

Do NOT treat those two values as manufacturer specifications.

The predecessor using the same layout shows the rear kitchen working as
an efficient compact service area and locates the 148 L refrigerator
near the rear of the lounge/service transition. ([21RV][2])

---

# 9. Bathroom geometry

The bathroom is a completely enclosed wet bathroom, not merely a toilet
cabinet.

Known contents:

```text
- one-piece moulded waterproof interior
- Thetford cassette toilet
- small integrated wash basin
- faucet
- shower head
- usable as shower + toilet + washroom
```

Published material does NOT provide reliable internal L × W dimensions.

For conceptual 3D work, use something roughly in the class of:

```text
~800-950 mm wide
~900-1100 mm deep

ESTIMATED ONLY
```

Do not create a residential-sized bathroom.

An adult should be able to:

```text
enter
stand
use toilet
turn with limited clearance
shower in the same enclosure
```

but the space should visually remain compact.

---

# 10. Sliding partition

This is structurally important to the visual model.

Position:

```text
REAR SERVICE ROOM
       |
       |
=====================   <- sliding partition
       |
       |
MAIN LOUNGE
```

The partition spans approximately the usable interior width.

It should visually read as a REAL ROOM DIVIDER rather than:

```text
X curtain
X decorative screen
X half-height cabinet
```

It can be closed to make:

```text
ZONE 1: kitchen + bathroom + rear entrance

ZONE 2: lounge + beds + cab
```

This separation is one of the defining differences between the 境 layout
and many conventional C-class motorhomes.

---

# 11. 3D sectional mental model

Think of the interior as four stacked/adjacent volumes:

```text
                         FRONT
                           --->

 Z
 ^
 |
 |         ┌──────────────────────┐
 |         │    CAB-OVER BED      │
 |         │    2200 x 1400       │
 |         └──────────────────────┘
 |
 | ┌────────────┐ ┌──────────────┐
 | │ REAR       │ │              │      ┌──────────┐
 | │ SERVICE    │ │    LOUNGE    │      │ DRIVER   │
 | │ KITCHEN +  │ │              │      │ CAB      │
 | │ BATHROOM   │ │              │      │          │
 | │            │ │              │      │          │
 | └────────────┘ └──────────────┘      └──────────┘
 +----------------------------------------------------> X
   REAR                                             FRONT

       ^                  ^
       |                  |
  door in the       side-slide located
  kerb flank,        around lounge
  near the rear
```

So the vehicle is not simply:

```text
cab -> lounge -> kitchen -> rear bed
```

Instead it is:

```text
rear entrance
     ->
rear utility room
     ->
closed/open partition
     ->
large lounge
     ->
cab
     +
bed stacked ABOVE cab
```

---

# 12. Parked vs driving-state geometry

The agent should understand that the interior has at least two important
geometrical states.

## Driving state

```text
side slide: retracted
sofa bed:   retracted
table:      folded/stowed as required

Result:
narrower but usable central passage.
```

## Parked daytime state

```text
side slide: deployed
sofa:       sofa configuration
table:      deployed as needed

Result:
maximum lounge floor area.
```

## Parked nighttime state

```text
side slide: deployed
sofa bed:   pulled out to 2000 × 1350 mm
table:      stowed

Result:
secondary double/single-large sleeping area occupies much of lounge.
```

---

# 13. Simplified ASCII axonometric view

Use this only to understand the volumes, not as an exact perspective.

```text
                       FRONT
                         /\
                        /  \
          __________________________________
         /        CAB-OVER BED              /|
        /        2200 x 1400               / |
       /___________________________________/  |
       |                                   |  |
       |           MAIN LOUNGE             |  |
       |                                   |  |
       | seats          aisle       sofa   |  |
       |                            / bed   |  |
       |___________________________________|  |
       |        sliding partition          | /
       |===================================|/
       |                                   |
       |   WASHROOM         tall cabinet   |__  door in the kerb
       |                                   |     flank, forward of
       |   worktop / sink / fridge         |     the rear corner
       |___________________________________|
           rear wall closed, ventilation
           window over the worktop

                       REAR
```

---

# 14. What the agent must NOT invent

Unless better reference material is supplied, leave these parameters
flexible:

1. Exact external L × W × H of the 境500MAX.
2. Exact internal ceiling height.
3. Exact internal sizes of the rear cabinet runs.
4. Exact dimensions of the bathroom.
5. Exact dimensions of kitchen cabinets.
6. Exact width and travel of the side slide-out.
7. Exact aisle widths.
8. Exact partition-door width.
9. Exact cabinet dimensions.
10. Exact window sizes and positions.

Known dimensions should have higher authority than inferred geometry:

```
2200 × 1400 mm    cab-over bed
2000 × 1350 mm    convertible lounge bed
```

Owner feedback fixes the following, and they carry the same authority as
those two bed sizes:

```
passenger door      kerb (right) flank, forward of the rear corner
rear elevation      closed, one ventilation window over the worktop
washroom pod        off (left) flank, against the partition
worktop run         backs onto the rear wall, crosses the centreline,
                    fridge at its off end
combi-oven cabinet  kerb flank, forward of the door
entry path          in, leftward across the width, right turn at the
                    washroom door, through the partition, lounge
```

Everything marked ESTIMATED is only for getting the spatial proportions
right.

```

### Short version for a 3D-generation agent

If the receiving agent does not need all the detail above, this is the compact description I would use:

> Model a roughly six-metre C-class Iveco motorhome with a single side slide-out in the central lounge and one passenger door in the kerb (right) flank, forward of the rear corner. The rear elevation is closed; its only opening is a ventilation window over the kitchen worktop. Unlike a conventional RV, the rear is a self-contained utility zone containing the kitchen and enclosed shower/toilet room. Immediately forward of that zone is a full-width sliding partition that can isolate cooking, toilet and shower activity from the main living space. Forward of the partition is a large lounge. One side has three individual adjustable automotive-style seats and a folding wall table; the opposite side has a roughly 2.0 m long sofa that pulls out into a confirmed 2000 × 1350 mm bed. The slide-out expands this lounge laterally when parked. Continue forward through an open connection into the Iveco driver cab. Above the cab is the permanent main double bed, confirmed at 2200 mm across the vehicle × 1400 mm front-to-back. Treat the cab-over bed as an elevated mezzanine volume. Use an approximately 6.0 m × 2.45 m × 3.1-3.2 m outer envelope only as a visualization scaffold, not as verified 境500MAX engineering geometry. The strongest visual concept is the sequence: **kerb-flank rear door → cross the cabin's width leftward → right turn at the washroom door, toward the front → closable sliding partition → expandable living room → driver cab, with the main bedroom stacked above the cab.**

The predecessor 境280 is particularly useful as a visual reference because 21世纪房车 documents essentially the same **kerb-flank rear entry + isolated rear kitchen/bath + three-seat lounge + 2000 × 1350 sofa bed + 2200 × 1400 cab-over bed** architecture, while the 2026 境500 coverage confirms that this arrangement carries over to the Iveco-based model. :contentReference[oaicite:4]{index=4}
```

[1]: https://www.21rv.com/auto/brand/359?utm_source=chatgpt.com "大驰房车 - 官网|车型总览|经销商|预约试驾"
[2]: https://www.21rv.com/news/article/7c41a93f-fb2e-11ef-ab84-68cc6e7850f5?utm_source=chatgpt.com "不到50万，后上门两张大床还有地暖，大驰无极境280侧拓展房车 - 21世纪房车"
[3]: https://www.sohu.com/a/1024282184_99893844?utm_source=chatgpt.com "侧拓展C型房车怎么选？看完2026新款大驰无极·境500房车，心里就有数了_搜狐汽车_搜狐网"
