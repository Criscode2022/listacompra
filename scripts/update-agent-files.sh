#!/bin/sh
# Updates the files this repository takes from official sources:
#   - the skills in .agents/skills (Claude Code reaches them through the links in .claude/skills)
#   - Angular's official rules at the top of AGENTS.md (GEMINI.md is a link to AGENTS.md)
#   - SKILLS.lock.md, which records the commit each skill came from
#
# Run it from the repository root (on Windows, from Git Bash or WSL). Then read `git diff`
# before you commit: these files steer what coding agents do in this repository.
set -eu

# One line per skill: name | source repository | folder in that repository | license
SKILLS='angular-developer|https://github.com/angular/skills|angular-developer|MIT, declared in its SKILL.md
angular-new-app|https://github.com/angular/skills|angular-new-app|MIT, declared in its SKILL.md
clean-code|https://github.com/markoa/clean-code-skill|skills/clean-code|MIT, see third_party/clean-code-skill/
frontend-design|https://github.com/anthropics/skills|skills/frontend-design|Apache-2.0, LICENSE.txt inside the skill
impeccable|https://github.com/pbakaus/impeccable|.agents/skills/impeccable|Apache-2.0, see third_party/impeccable/
neon-auth|https://github.com/neondatabase/agent-skills|skills/neon-auth|Apache-2.0, see third_party/neon-agent-skills/
spartan|https://github.com/spartan-ng/spartan|skills/spartan|MIT, https://github.com/spartan-ng/spartan'

ANGULAR_CONTEXT_URL='https://angular.dev/assets/context'

update_skills() {
  echo "$SKILLS" | while IFS='|' read -r name repo _folder _license; do
    # github-copilot keeps the files in .agents/skills; claude-code adds the link in .claude/skills.
    npx -y skills add "$repo" --skill "$name" --agent claude-code github-copilot -y < /dev/null
  done
}

write_skills_lock() {
  {
    printf '# Skills lock\n\n'
    printf 'Written by `scripts/update-agent-files.sh` on %s. Each skill lives once, in `.agents/skills/<skill>/`. `.claude/skills/<skill>` is a link to it.\n\n' "$(date +%Y-%m-%d)"
    printf '| Skill | Source | Folder in source | Commit | License |\n'
    printf '| --- | --- | --- | --- | --- |\n'
    echo "$SKILLS" | while IFS='|' read -r name repo folder license; do
      commit=$(git ls-remote "$repo" HEAD < /dev/null | cut -f1)
      printf '| `%s` | %s | `%s` | `%s` | %s |\n' "$name" "$repo" "$folder" "$commit" "$license"
    done
    local_skills=''
    for dir in .agents/skills/*; do
      name=${dir##*/}
      if [ -d "$dir" ] && ! echo "$SKILLS" | grep -q "^$name|"; then
        local_skills="$local_skills\`$name\`, "
      fi
    done
    if [ -n "$local_skills" ]; then
      printf '\nWritten for this repository, from the official docs each one links to: %s. They have no upstream source, and this script leaves them alone.\n' "${local_skills%, }"
    fi
    printf '\nTo check a skill against its source, clone the source at the listed commit and compare:\n\n'
    printf '```sh\n'
    printf 'git clone https://github.com/angular/skills ../angular-skills\n'
    printf 'git -C ../angular-skills checkout <commit>\n'
    printf 'diff -r ../angular-skills/angular-developer .agents/skills/angular-developer\n'
    printf '```\n\n'
    printf 'No output means the copy matches. `skills-lock.json` is the `skills` CLI'"'"'s own record of the same installs.\n'
  } > SKILLS.lock.md
}

# Appended below Angular's text. Everything above it stays exactly as Angular publishes it.
project_section() {
  cat <<'EOF'

<!-- Project section: maintained in this repository, not by Angular. Everything above is Angular's official AGENTS.md, unchanged. -->

## Project rules

Read [PROJECT.md](PROJECT.md) and [APP.md](APP.md) before any change. PROJECT.md adds the template's rules for skills, the app type, the Angular CLI and Neon MCP servers, secrets, and LLM features. APP.md has the rules for this app alone.

Before you build the app, find its type: the one the user's prompt names, or else `appType` in `preferences.json`. If neither gives one, don't pick a type yourself. Ask the user which type of app they want, and say that this repository includes four: a classic Angular SPA, a modern SSR app, a PWA with Ionic, and a native app with Angular Native and Expo Go. PROJECT.md has the details.
EOF
}

update_angular_rules() {
  official=$(mktemp)
  trap 'rm -f "$official"' EXIT
  curl -fsSL "$ANGULAR_CONTEXT_URL/AGENTS.md" -o "$official"
  # angular.dev answers some unknown paths with its HTML app shell, so a 200 alone proves nothing.
  if head -n 1 "$official" | grep -qi '<!doctype html'; then
    echo "angular.dev sent a web page instead of AGENTS.md. AGENTS.md was left unchanged." >&2
    exit 1
  fi
  { cat "$official"; project_section; } > AGENTS.md

  # One copy serves every editor because Angular publishes identical text as GEMINI.md and
  # guidelines.md (the Copilot file). Say so if that ever changes.
  for name in GEMINI.md guidelines.md; do
    if ! curl -fsSL "$ANGULAR_CONTEXT_URL/$name" | cmp -s - "$official"; then
      echo "Note: Angular's $name no longer matches AGENTS.md. Review $ANGULAR_CONTEXT_URL/$name" >&2
    fi
  done
}

if [ ! -f angular.json ]; then
  echo 'Run this script from the repository root.' >&2
  exit 2
fi

# The impeccable skill is replaced from upstream. Put this repository's layout rule
# back so a refresh does not start asking the user to pick a layout again.
restore_impeccable_layout_rule() {
  skill=.agents/skills/impeccable/SKILL.md
  if [ ! -f "$skill" ]; then
    echo 'impeccable SKILL.md is missing; the layout rule was not restored.' >&2
    return 0
  fi
  if grep -q '## Use it, and choose the layout' "$skill"; then
    return 0
  fi
  tmp=$(mktemp)
  if ! awk '
    inserted == 0 && $0 == "Core principles:" {
      print "## Use it, and choose the layout"
      print ""
      print "Projects that include this skill use it for UI work. Do not ask whether to use it."
      print ""
      print "Do not ask the user to choose a layout, a visual direction, a concept card, a comp, or a re-roll. Choose the strongest layout that fits the product, the existing design, and the request, then build it. That choice replaces the decision page, the concept-seed hand, and any other menu of layouts in the references below. When this section conflicts with a reference, this section wins."
      print ""
      print "Ask about a layout only when the user explicitly asks to see options, compare layouts, or pick one. Then follow the reference that presents those choices."
      print ""
      inserted = 1
    }
    { print }
    END { if (inserted == 0) exit 2 }
  ' "$skill" > "$tmp"; then
    rm -f "$tmp"
    echo 'Could not restore the impeccable layout rule: "Core principles:" was not found.' >&2
    return 0
  fi
  mv "$tmp" "$skill"
}

update_skills
restore_impeccable_layout_rule
write_skills_lock
update_angular_rules
echo 'Updated. Review the changes with: git diff --stat'
