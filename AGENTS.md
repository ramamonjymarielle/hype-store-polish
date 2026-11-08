<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- The HYPE storefront lives in src/hype/ (imported single-file app, client-only via lazy+ClientOnly at /) because it relies on window/localStorage at init.
- Products and orders are authoritative in Cloud; place orders atomically with server-priced variants and stock checks to prevent price tampering and overselling.
- Admin access uses Cloud Auth and a protected user_roles row; browser state never authorizes catalog or order mutations.
- Shared commerce helpers define presentation totals and phone normalization; database rules independently validate checkout input.
