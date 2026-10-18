# GitHub project workflow

## Repository and visibility

Use the private repository `touhid404/furniture-commerce`. The initial `main` commit establishes secret and analysis-image exclusions. The historical foundation branch is `feat/documentation-and-neon-foundation`. Full implementation is maintained on `feat/commerce-platform` in PR 6, which supersedes the initial foundation draft. Do not commit `.env.local`, `.env`, `.neon`, generated Prisma client, dependencies, video, extracted frames, crop images or render previews.

Only source, versioned JSON, API contracts, documentation, tests, workflow files and the text-only editable specification are shared. The original video and analysis images remain local by owner request. Keep secret scanning in local review even though the repository is private.

## Issue and milestone structure

Group work by the phases in the delivery plan: foundation, reference storefront, commerce, admin, after-purchase and release. Each issue states outcome, affected requirements, dependencies and acceptance tests. Separate provider selection from integration work. A task is complete only when its evidence is recorded. Milestone dates remain unset until scope and capacity are estimated.

Use labels such as documentation, frontend, backend, database, security, testing and blocked only when useful. Avoid automatically assigning work or requesting review from someone who has not agreed to participate. Issues and PRs belong to the same private project; no project content is posted elsewhere.

## Review and automation

CI validates documentation links, JSON, configuration behavior, tests, Prisma schema and production build. It needs no production database credentials. Database and provider tests use isolated environments and are added to protected integration workflows as those modules are delivered. Keep PRs focused and include data/config rollout steps.

After the first workflow run, configure main-branch review and status requirements where supported by the account plan. Do not state that protections or CI are active merely because a YAML file exists. Remote run results and enforcement status must be checked separately. Repository-maintenance work must not grant new collaborators or broaden app permissions without a concrete need.

## Release discipline

Merge only reviewed, validated work. The completed implementation uses a protected PR merge to preserve the focused milestone commits. Maintain changelog and release notes. Use a staged release branch or tagged main commit, reviewed migrations and a rollback plan. Run the release acceptance checklist before a production commerce release. The initial setup branch can remain open for owner review while implementation continues through later scoped PRs.
