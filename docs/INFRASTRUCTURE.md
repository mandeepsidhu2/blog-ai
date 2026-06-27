# Infrastructure

Blog AI infrastructure is app-specific and lives outside this repo:

```text
../infrastructure/blog-ai-frontend
```

Application source repository:

```text
git@github.com:mandeepsidhu2/blog-ai.git
```

Do not add Blog AI resources to the retired shared `frontend-apps` stack.

## CloudFront And S3 Shape

The intended production shape is:

```text
CloudFront
  default behavior -> S3 app bucket -> dist/app
  content/*        -> S3 content bucket -> dist/content/content
  tutorials/*      -> S3 content bucket -> dist/content/tutorials
```

The app bucket holds the lightweight shell and assets.

The content bucket holds:

- SEO tutorial pages under `/tutorials/*`.
- content JSON payloads under `/content/v1/*`.

## Pipeline Shape

Buildspecs live in `pipeline/`:

- `buildspec.test.yml`: install, build, and run generated-site checks.
- `buildspec.build.yml`: build and emit `dist/pipeline-artifact`.
- `buildspec.deploy.yml`: sync app and content outputs to separate S3 buckets.
- `buildspec.invalidate.yml`: invalidate CloudFront.

Terraform injects:

- `FRONTEND_APP_DIR=.`
- `SITE_URL=https://learn.toolsite.com`
- `FRONTEND_BUCKET`
- `CONTENT_BUCKET`
- `CLOUDFRONT_DISTRIBUTION_ID`

## Safety

- Do not run `aws`, `terraform`, `tofu`, or cloud-mutating commands.
- Infrastructure edits must be reviewable as code.
- Existing resources from the retired shared stack need state migration or
  import before applying the app-specific stack.
- Route 53 and ACM custom-domain resources are intentionally not enabled while
  the AWS account remains on the Free plan.
