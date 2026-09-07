# Walkthrough video stills

Frames from the manufacturer's 18-minute walkthrough
(douyin.com/video/7627690532785694434, 新款房车发布：大驰境500，后上门后置厨卫车型做到极致),
kept because handedness could not be settled from the product-page stills and four passes got it
wrong trying.

Two files carry a `-sohu` suffix instead of a timestamp. Those come from the 2026-05-18 搜狐汽车
review (sohu.com/a/1024282184_99893844), whose interior set is shot wider and brighter than any
video frame. They are the reason the pod and the fridge changed places.

| File | Settles |
|---|---|
| `lounge-aft-through-partition-8m32s.jpg` | Camera in the lounge looking aft: sofa bench left, booth seats right. Looking aft, left is kerb — so sofa kerb, booth off |
| `lounge-aft-through-partition-8m56s.jpg` | The same view, clearer: fridge column right of the doorway, beside a booth seat |
| `partition-doorway-detail.png` | Upscaled crop through the doorway: galley pegboard and counter on the left, glazed washroom door on the right — galley kerb, pod off |
| `rear-door-looking-forward-3m50s.jpg` | Through the open rear side door, where left and right reverse. Agrees: counter right, pod's blank outer wall left |
| `exterior-kerb-flank-0m59s.jpg` | Nose at frame right, so this is the vehicle's right side: the kerb flank carries the awning, the external washer and the storage hatches |
| `kerb-window-crop-1m17s.jpg` | Through that flank's one large window: a walnut overhead run with three LED bars over a counter — the galley, on the kerb flank |
| `entry-door-from-inside-5m10s.jpg` | The presenter in the open boarding door. A counter runs away on each side of him: combi oven and coffee machine on one, the window and the basket on the other. Facing the kerb flank, frame right is aft, so the window is in the REAR wall |
| `rear-worktop-sink-6m20s.jpg` | The black composite sink and gooseneck under that rear window, hood over it, open boarding door beside it. The run backs onto the rear wall |
| `fridge-open-at-partition-6m56s.jpg` | "这个位置是房车专用冰箱", opened from the lounge side with a booth seat over his shoulder. The fridge stands at the PARTITION, not in the rear corner |
| `washroom-rear-corner-7m04s.jpg` | "就是把整个夹角利用起来". Facing the off flank: rear worktop and hood on the left, the pod straight ahead, panelling forward of it. The pod is in the REAR-OFF corner, entered from the aisle beside the worktop |
| `service-room-high-angle-sohu.jpg` | The whole room in one frame from above the partition. Left to right: partition doorway with the lounge beyond, the kerb counter, the open boarding door (louvred panel, grab handle, door bin: not a washroom door), then the rear worktop under its blind |
| `lounge-from-partition-sohu.jpg` | The slide-out bench square-on, service room showing past the partition post. Pins which flank the sliding leaf parks on |

Read together these give the hybrid layout recorded in `src/check.test.ts`'s handedness guard.
They also settle the order along the off flank, which the flank assignment alone does not: from
the partition aft it is fridge column, then washroom pod, then the rear wall. The model carried
the reverse until 2026-09-07: pod at the partition, fridge in the corner. That is the one thing
the spatial brief's prose got wrong.

The video also settles, independently of handedness: a rear side door with keypad and grab
handle, 前一后二 booth with a drawer in the table, "3米2" overall height, walnut-dominant cabin,
black composite sink and gooseneck tap, no interior washer, 270 L fresh water.
