# Audio Directory

This directory organizes all sound effects, ambient tracks, music, and voice/animal sounds for the game.

```
audio/
├── music/
│   ├── day.mp3
│   ├── night.mp3
│   └── forest.mp3
├── ambient/
│   ├── wind.mp3          (loop)
│   ├── crickets.mp3      (loop, night)
│   ├── fire.mp3          (loop, campfire)
│   ├── water.mp3         (loop, pond)
│   └── birds.mp3         (loop, day)
├── player/
│   ├── step.mp3
│   ├── run.mp3
│   ├── jump.mp3
│   ├── land_soft.mp3
│   ├── land_hard.mp3
│   ├── skid.mp3
│   ├── swim.mp3
│   ├── splash.mp3
│   └── pickup.mp3
├── combat/
│   ├── punch.mp3
│   ├── kick.mp3
│   ├── knife_stab.mp3
│   ├── knife_throw.mp3
│   ├── knife_pull.mp3
│   ├── slash.mp3
│   └── hit_body.mp3
├── guns/
│   ├── revolver_shot.mp3
│   ├── revolver_reload.mp3
│   ├── shotgun_shot.mp3
│   ├── shotgun_pump.mp3
│   ├── shotgun_reload.mp3
│   └── click_empty.mp3
├── gore/
│   ├── blood_splat.mp3
│   ├── bone_crack.mp3
│   ├── squish.mp3
│   ├── rip.mp3
│   └── head_burst.mp3
├── animals/
│   ├── horse_gallop.mp3
│   ├── horse_neigh.mp3
│   ├── horse_huff.mp3
│   ├── duck_quack.mp3
│   ├── duckling_peep.mp3
│   ├── frog_croak.mp3
│   └── croc_snap.mp3
└── ui/
    ├── lantern.mp3
    ├── lighter.mp3
    └── banner.mp3
```

All files can be loaded using HTML5 Audio (`new Audio('audio/.../filename.mp3')`) or the Web Audio API.
