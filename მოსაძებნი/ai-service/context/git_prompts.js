
/**
 * Git-specific prompts and commands for Gurulo AI Assistant
 */

const GIT_PROMPTS = {
  git_operations: `
თქვენ ხართ Gurulo AI Assistant Git Operations Expert.
თქვენი მისიაა დახმარება Git commands-ის გამოყენებაში, repository management-ში და საუკეთესო პრაქტიკის დაცვაში.

Git Operations რომელსაც შეგიძლიათ შეასრულოთ:

1. **Repository Status**
   - git status - repository მდგომარეობის შემოწმება
   - git log - commit history-ის ნახვა (commit range, decorated output)
   - git diff - ფაილების ცვლილებების ნახვა (working tree, staged, branch comparison)

2. **File Operations**
   - git add [files] - ფაილების staging area-ში დამატება
   - git reset [files] - ფაილების unstaging
   - git restore [--staged] [file] - tracked ფაილების დაბრუნება
   - git checkout -- [file] - ფაილის ცვლილებების გაუქმება

3. **Commit Operations**
   - git commit -m "message" - ცვლილებების commit
   - git commit --amend - ბოლო commit-ის შესწორება
   - git revert <commit> - commit-ის უკან დაბრუნება უსაფრთხოდ

4. **Branch Management**
   - git branch - ყველა branch-ის ნახვა
   - git checkout -b [branch] - ახალი branch-ის შექმნა
   - git switch [branch] - branch-ზე გადართვა
   - git merge [branch] - branch-ების merge

5. **Remote Operations**
   - git push origin [branch] - remote repository-ში upload
   - git pull origin [branch] - remote-დან download
   - git fetch --all --prune - remote ინფორმაციის განახლება

6. **Advanced Operations**
   - git rebase [base] - commit history-ის ხელახლა აგება
   - git rebase -i [base] - interactive rebase-ს დაგეგმვა
   - git cherry-pick <commit> - კონკრეტული ცვლილების გადმოყვანა
   - git stash (save/apply/pop) - დროებითი ცვლილებების მართვა
   - git tag [-a] <tag> - release ან checkpoint tag-ების შექმნა

7. **Conflict Resolution**
   - merge conflicts-ის იდენტიფიცირება
   - conflict resolution strategies (ours/theirs/manual)
   - rerere/merge tool-ის გამოყენების რჩევები

**Common Errors and Resolutions**
- Merge conflict (exit code 1): ახსენით რომ საჭიროა conflicted ფაილების რედაქტირება, git add და git commit.
- Non-fast-forward push: შესთავაზეთ git pull --rebase origin <branch> ან git push --force-with-lease.
- Detached HEAD: აუხსენით როგორ დაბრუნდეს git switch <branch> ან შექმნას ახალი branch.
- Dirty working tree rebase-ისას: გამოიყენეთ git stash ან commit სანამ rebase დაიწყება.

**Workflow Examples**
- Feature branch workflow: შექმენი branch, იმუშავე commits-ზე, გაუშვი tests, merge/pull request.
- Hotfix release: checkout production branch, შექმენი hotfix branch, cherry-pick საჭირო commits, tag release, merge back main-ში.
- Release preparation: გამოიყენე git tag და changelog გენერაცია (git log --oneline <prev_tag>..HEAD).

**Integration Tips**
- საჭიროებისამებრ გამოიყენე simple-git ან official GitHub API ავტომატიზაციისთვის.
- აღწერე როგორ შეიძლება სკრიპტიდან git command-ის გაშვება და მიღებული შედეგის ლოგირება.

RESPONSE FORMAT:
{
  "tool_name": "git_command",
  "parameters": {
    "operation": "status|add|commit|push|pull|merge|rebase|stash|tag|etc",
    "files": ["file1", "file2"],
    "message": "commit message",
    "branch": "branch_name",
    "options": {}
  },
  "explanation": "ქართულად ახსნა რა მოხდება და რა რისკებია"
}

მაგალითები:
- "ყველა ფაილის staging" → git add .
- "ცვლილებების commit 'fix bugs' message-ით" → git commit -m "fix bugs".
- "main branch-ზე გადართვა" → git checkout main.
- "origin-ზე push" → git push origin <branch>.
- "commit-ის rebase-ით გადაწერა" → git rebase -i HEAD~3.
`,

  replit_style_summary: `**🟠 Replit-Style Git Workflow - Gurulo Edition**

**პასუხის ფორმატი:**
- გამოიყენე ქართულ-ინგლისური ტერმინები;
- დაამატე ემოჯიები (✅, ❌, ⚠️) და Markdown ბლოკები;
- გამოიყენე `<details>` ელემენტები ცვლილებებისა და ლოგების ჩამოსათვლელად.

**სექციები:**
1. **Title Banner:** `🟠 Workflow {{branchOrTask}}`
2. **Read X files:** შექმენი `<details><summary>Read X files</summary>...</details>` და ჩამოთვალე stage-ში მყოფი ფაილები (`git status --short` ან მოწოდებული სია).
3. **Explanation:** 1-2 წინადადება ქართულად, რას ასწორებს commit/branch.
4. **Service Check (Optional):** თუ ხელმისაწვდომია `checkServiceStatuses`, დაამატე numbered list `1. ✅ Backend (5002)`.
5. **Git Script:** ჩასვი ```bash``` ბლოკში `[Copy]` წარწერით, სადაც აღწერილია შესასრულებელი git ბრძანებები (`git add`, `git commit`, `git push`). Error handling-სთვის დაამატე `set -e` და კომენტარები ქართულად.
6. **Results:** bullet სია `✅ Commit შექმნილია`, `✅ Push დასრულდა`. ბოლოს დაამატე `<details><summary>Scroll to latest logs</summary>git output...</details>`.

**წესები:**
- არასდროს გაუშვა რეალური git command-ები ავტონომიურად; მხოლოდ შესთავაზე.
- გამოიყენე helper მონაცემები (მაგ. `generateFileListSummary`) რომ ფაილების მოკლე აღწერები მიაწოდო.
- თუ ინფორმაცია აკლია, მიუთითე `⚠️ მონაცემი მიუწვდომელია`.
`,

  conflict_resolution: `
თქვენ ხართ Git Merge Conflicts Resolution Expert.

Conflict Resolution Steps:
1. Identify conflicted files
2. Analyze conflict markers (<<<<<<< ======= >>>>>>>)
3. Provide resolution strategies:
   - Accept ours (current branch changes)
   - Accept theirs (merging branch changes)
   - Manual merge (combine both)
   - Custom resolution

Always explain conflicts in Georgian and provide clear resolution options.
`,

  interactive_rebase: `
თქვენ ხართ Interactive Rebase Assistant.

Rebase Operations:
- pick: commit-ის დატოვება
- reword: commit message-ის შეცვლა
- edit: commit-ის შესწორება
- squash: წინა commit-თან გაერთიანება
- drop: commit-ის წაშლა

Help users plan and execute interactive rebases safely.
`
};

const GIT_COMMAND_TEMPLATES = {
  status: {
    operation: 'status',
    description: 'Repository status-ის შემოწმება',
    defaults: {
      options: {}
    },
    allowedParams: ['options'],
    requiredParams: [],
    paramTypes: {
      options: 'object'
    }
  },

  add_all: {
    operation: 'add',
    description: 'ყველა ცვლილების staging',
    defaults: {
      files: ['.'],
      options: {}
    },
    allowedParams: ['files', 'options'],
    requiredParams: [],
    paramTypes: {
      files: 'array',
      options: 'object'
    }
  },

  add: {
    operation: 'add',
    description: 'კონკრეტული ფაილების staging',
    defaults: {
      files: [],
      options: {}
    },
    allowedParams: ['files', 'options'],
    requiredParams: ['files'],
    paramTypes: {
      files: 'array',
      options: 'object'
    }
  },

  commit: {
    operation: 'commit',
    description: 'ცვლილებების commit',
    defaults: {
      message: '',
      options: {}
    },
    allowedParams: ['message', 'options'],
    requiredParams: ['message'],
    paramTypes: {
      message: 'string',
      options: 'object'
    }
  },

  amend_commit: {
    operation: 'commit',
    description: 'ბოლო commit-ის შეცვლა --amend ოპციით',
    defaults: {
      message: '',
      options: { amend: true }
    },
    allowedParams: ['message', 'options'],
    requiredParams: [],
    paramTypes: {
      message: 'string',
      options: 'object'
    }
  },

  push: {
    operation: 'push',
    description: 'Remote repository-ში upload',
    defaults: {
      remote: 'origin',
      branch: '',
      options: {}
    },
    allowedParams: ['remote', 'branch', 'options'],
    requiredParams: ['branch'],
    paramTypes: {
      remote: 'string',
      branch: 'string',
      options: 'object'
    }
  },

  pull: {
    operation: 'pull',
    description: 'Remote-დან download',
    defaults: {
      remote: 'origin',
      branch: '',
      options: {}
    },
    allowedParams: ['remote', 'branch', 'options'],
    requiredParams: ['branch'],
    paramTypes: {
      remote: 'string',
      branch: 'string',
      options: 'object'
    }
  },

  fetch: {
    operation: 'fetch',
    description: 'Remote ცვლილებების მიღება merge-ის გარეშე',
    defaults: {
      remote: 'origin',
      options: {}
    },
    allowedParams: ['remote', 'options'],
    requiredParams: [],
    paramTypes: {
      remote: 'string',
      options: 'object'
    }
  },

  create_branch: {
    operation: 'create_branch',
    description: 'ახალი branch-ის შექმნა',
    defaults: {
      branch: '',
      options: {}
    },
    allowedParams: ['branch', 'options'],
    requiredParams: ['branch'],
    paramTypes: {
      branch: 'string',
      options: 'object'
    }
  },

  switch_branch: {
    operation: 'switch_branch',
    description: 'არსებულ branch-ზე გადართვა',
    defaults: {
      branch: '',
      options: {}
    },
    allowedParams: ['branch', 'options'],
    requiredParams: ['branch'],
    paramTypes: {
      branch: 'string',
      options: 'object'
    }
  },

  merge: {
    operation: 'merge',
    description: 'Branch-ების merge',
    defaults: {
      branch: '',
      options: {}
    },
    allowedParams: ['branch', 'options'],
    requiredParams: ['branch'],
    paramTypes: {
      branch: 'string',
      options: 'object'
    }
  },

  rebase: {
    operation: 'rebase',
    description: 'Branch-ის ისტორიის ხელახლა აგება',
    defaults: {
      upstream: '',
      options: {}
    },
    allowedParams: ['upstream', 'options'],
    requiredParams: ['upstream'],
    paramTypes: {
      upstream: 'string',
      options: 'object'
    }
  },

  interactive_rebase: {
    operation: 'rebase',
    description: 'Interactive rebase-ის დაწყება',
    defaults: {
      upstream: '',
      options: { interactive: true }
    },
    allowedParams: ['upstream', 'options'],
    requiredParams: ['upstream'],
    paramTypes: {
      upstream: 'string',
      options: 'object'
    }
  },

  cherry_pick: {
    operation: 'cherry_pick',
    description: 'კონკრეტული commit-ის გადმოყვანა',
    defaults: {
      commits: [],
      options: {}
    },
    allowedParams: ['commits', 'options'],
    requiredParams: ['commits'],
    paramTypes: {
      commits: 'array',
      options: 'object'
    }
  },

  stash_save: {
    operation: 'stash_save',
    description: 'ცვლილებების დროებით შენახვა',
    defaults: {
      message: '',
      options: {}
    },
    allowedParams: ['message', 'options'],
    requiredParams: [],
    paramTypes: {
      message: 'string',
      options: 'object'
    }
  },

  stash_apply: {
    operation: 'stash_apply',
    description: 'ბოლო stash-ის გამოყენება',
    defaults: {
      stashRef: '',
      options: {}
    },
    allowedParams: ['stashRef', 'options'],
    requiredParams: [],
    paramTypes: {
      stashRef: 'string',
      options: 'object'
    }
  },

  stash_pop: {
    operation: 'stash_pop',
    description: 'stash-ის გამოყენება და წაშლა',
    defaults: {
      stashRef: '',
      options: {}
    },
    allowedParams: ['stashRef', 'options'],
    requiredParams: [],
    paramTypes: {
      stashRef: 'string',
      options: 'object'
    }
  },

  tag_create: {
    operation: 'tag_create',
    description: 'Annotated ან lightweight tag-ის შექმნა',
    defaults: {
      tagName: '',
      message: '',
      options: {}
    },
    allowedParams: ['tagName', 'message', 'options'],
    requiredParams: ['tagName'],
    paramTypes: {
      tagName: 'string',
      message: 'string',
      options: 'object'
    }
  },

  tag_delete: {
    operation: 'tag_delete',
    description: 'Tag-ის წაშლა',
    defaults: {
      tagName: '',
      options: {}
    },
    allowedParams: ['tagName', 'options'],
    requiredParams: ['tagName'],
    paramTypes: {
      tagName: 'string',
      options: 'object'
    }
  },

  reset_hard: {
    operation: 'reset',
    description: 'Working tree-ს reset --hard',
    defaults: {
      target: 'HEAD',
      options: { hard: true }
    },
    allowedParams: ['target', 'options'],
    requiredParams: [],
    paramTypes: {
      target: 'string',
      options: 'object'
    }
  }
};

const TYPE_CHECKERS = {
  string: (value) => typeof value === 'string',
  array: (value) => Array.isArray(value),
  object: (value) => value !== null && typeof value === 'object' && !Array.isArray(value),
  boolean: (value) => typeof value === 'boolean'
};

const cloneValue = (value) => {
  if (Array.isArray(value)) {
    return [...value];
  }

  if (value !== null && typeof value === 'object') {
    return { ...value };
  }

  return value;
};

function validateGitParams(templateName, params = {}) {
  const template = GIT_COMMAND_TEMPLATES[templateName];

  if (!template) {
    return {
      valid: false,
      errors: [`უცნობი git command template: "${templateName}"`],
      parameters: null
    };
  }

  if (params === null || typeof params !== 'object' || Array.isArray(params)) {
    return {
      valid: false,
      errors: ['პარამეტრები უნდა იყოს ობიექტის ტიპის (key/value წყვილები).'],
      parameters: null
    };
  }

  const {
    requiredParams = [],
    allowedParams = [],
    defaults = {},
    paramTypes = {}
  } = template;

  const reservedKeys = new Set(['description', 'requiredParams', 'allowedParams', 'defaults', 'paramTypes']);
  const baseKeys = Object.keys(template).filter((key) => !reservedKeys.has(key));
  const defaultKeys = Object.keys(defaults || {});
  const allowed = new Set([...allowedParams, ...defaultKeys]);

  // Ensure template configuration consistency
  requiredParams.forEach((param) => {
    if (!allowed.has(param)) {
      allowed.add(param);
    }
  });

  const errors = [];

  requiredParams.forEach((param) => {
    const value = params[param] ?? defaults[param];
    if (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0)
    ) {
      errors.push(`აუცილებელი პარამეტრი "${param}" არ არის მითითებული template "${templateName}"-ისთვის.`);
    }
  });

  Object.keys(params).forEach((param) => {
    if (!allowed.has(param)) {
      errors.push(`პარამეტრი "${param}" არ არის მხარდაჭერილი template "${templateName}"-ში.`);
    }
  });

  Object.entries({ ...defaults, ...params }).forEach(([param, value]) => {
    if (paramTypes[param]) {
      const checker = TYPE_CHECKERS[paramTypes[param]];
      if (checker && !checker(value)) {
        errors.push(`პარამეტრი "${param}" უნდა იყოს ტიპის ${paramTypes[param]}.`);
      }
    }
  });

  const merged = {};
  baseKeys.forEach((key) => {
    merged[key] = template[key];
  });

  Object.entries(defaults).forEach(([key, value]) => {
    merged[key] = cloneValue(value);
  });

  Object.entries(params).forEach(([key, value]) => {
    merged[key] = cloneValue(value);
  });

  return {
    valid: errors.length === 0,
    errors,
    parameters: merged
  };
}

module.exports = {
  GIT_PROMPTS,
  GIT_COMMAND_TEMPLATES,
  validateGitParams
};
