# Skills lock

Written by `scripts/update-agent-files.sh` on 2026-10-03. Each skill lives once, in `.agents/skills/<skill>/`. `.claude/skills/<skill>` is a link to it.

| Skill | Source | Folder in source | Commit | License |
| --- | --- | --- | --- | --- |
| `angular-developer` | https://github.com/angular/skills | `angular-developer` | `cfb0e3603dfacdda1cafd66d98a071459fa2187a` | MIT, declared in its SKILL.md |
| `angular-new-app` | https://github.com/angular/skills | `angular-new-app` | `cfb0e3603dfacdda1cafd66d98a071459fa2187a` | MIT, declared in its SKILL.md |
| `clean-code` | https://github.com/markoa/clean-code-skill | `skills/clean-code` | `cf34d5e491ac7e1ba26411f523b4d9f9a92b98a8` | MIT, see third_party/clean-code-skill/ |
| `frontend-design` | https://github.com/anthropics/skills | `skills/frontend-design` | `8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4` | Apache-2.0, LICENSE.txt inside the skill |
| `impeccable` | https://github.com/pbakaus/impeccable | `.agents/skills/impeccable` | `e103efe779e2dd01274dabae83531fef00bf2563` | Apache-2.0, see third_party/impeccable/ |
| `neon-auth` | https://github.com/neondatabase/agent-skills | `skills/neon-auth` | `ae082b22275461fbb5e303a1bcdc9bb00b73a946` | Apache-2.0, see third_party/neon-agent-skills/ |
| `spartan` | https://github.com/spartan-ng/spartan | `skills/spartan` | `d09b75c826cf064508cac69958e21f883555e3fe` | MIT, https://github.com/spartan-ng/spartan |

Written for this repository, from the official docs each one links to: `ai-elements`, `angular-material`, `angular-native`, `angular-ssr`, `ionic-pwa`, `neon-data-api-rls`, `pen-dev-angular`, `tailwind-angular`. They have no upstream source, and this script leaves them alone.

To check a skill against its source, clone the source at the listed commit and compare:

```sh
git clone https://github.com/angular/skills ../angular-skills
git -C ../angular-skills checkout <commit>
diff -r ../angular-skills/angular-developer .agents/skills/angular-developer
```

No output means the copy matches. `skills-lock.json` is the `skills` CLI's own record of the same installs.
