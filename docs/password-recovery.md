# Recuperacao de senha

O TechTrack implementa recuperacao de senha usando os recursos nativos do Django. Nao existe tabela de token propria e nenhum segredo de recuperacao e armazenado no banco.

## Fluxo

1. O usuario acessa `/forgot-password` a partir do login.
2. O frontend envia `POST /api/v1/auth/password-reset/` com o e-mail.
3. A API sempre responde com a mesma mensagem, exista ou nao uma conta correspondente.
4. Para usuarios ativos com senha utilizavel, o backend gera:
   - `uid` com `urlsafe_base64_encode`;
   - token com `django.contrib.auth.tokens.default_token_generator`.
5. O e-mail aponta para `/reset-password/:uid/:token` no frontend.
6. O frontend envia a nova senha para `POST /api/v1/auth/password-reset/confirm/`.
7. O backend valida usuario, token, expiracao, confirmacao e `AUTH_PASSWORD_VALIDATORS`.
8. `set_password()` altera a senha. Como o token do Django depende do hash da senha, o link utilizado deixa de ser valido imediatamente.
9. O frontend redireciona para `/login` e exibe a confirmacao de sucesso.

Tokens invalidos, expirados ou ja utilizados retornam uma resposta de validacao equivalente, sem criar estado adicional no banco.

## Endpoints publicos

### Solicitar recuperacao

`POST /api/v1/auth/password-reset/`

```json
{
  "email": "usuario@exemplo.com"
}
```

Resposta HTTP 200, inclusive quando o e-mail nao existe:

```json
{
  "message": "Se existir uma conta ativa com esse e-mail, enviaremos as instrucoes para redefinir a senha."
}
```

### Confirmar nova senha

`POST /api/v1/auth/password-reset/confirm/`

```json
{
  "uid": "...",
  "token": "...",
  "new_password": "NovaSenhaForte!2026",
  "confirm_password": "NovaSenhaForte!2026"
}
```

## Variaveis de ambiente

```dotenv
FRONTEND_URL=https://app.seudominio.com
PASSWORD_RESET_TIMEOUT=3600
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.zoho.com
EMAIL_PORT=587
EMAIL_HOST_USER=techtrack@seudominio.com
EMAIL_HOST_PASSWORD=senha-ou-app-password
EMAIL_USE_TLS=True
EMAIL_USE_SSL=False
DEFAULT_FROM_EMAIL=TechTrack <techtrack@seudominio.com>
```

`FRONTEND_URL` deve ser a URL publica acessada pelo navegador, nao o endereco interno do container.

### Zoho Mail

A configuracao SMTP padrao do Zoho usa `smtp.zoho.com`, porta `587` e STARTTLS. Se a conta estiver em outro data center do Zoho, ajuste `EMAIL_HOST` para o host correspondente da conta. Com MFA/2FA, use uma senha de aplicativo no `EMAIL_HOST_PASSWORD`.

A documentacao atual do Zoho informa que contas gratuitas podem ter restricoes de SMTP para dominios personalizados. Caso o remetente use dominio proprio, confirme se o plano da conta permite envio SMTP.

Nunca versione a senha SMTP. Configure-a no ambiente de deploy ou no gerenciador de secrets da infraestrutura.

## Desenvolvimento local

Por padrao, com `DJANGO_DEBUG=True`, o Django usa o backend de console. No Compose, o default tambem e:

```dotenv
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
```

Ao solicitar a recuperacao, o conteudo completo do e-mail e impresso nos logs do backend. Isso permite copiar o link sem depender de um servidor SMTP local.

## Comportamento de seguranca

- resposta identica para e-mail existente e inexistente;
- apenas usuarios ativos e com senha utilizavel recebem link;
- token assinado pelo mecanismo nativo do Django;
- expiracao controlada por `PASSWORD_RESET_TIMEOUT`;
- senha nova validada pelos validadores configurados em `AUTH_PASSWORD_VALIDATORS`;
- token deixa de funcionar depois da troca de senha;
- falha de SMTP e registrada no backend, sem alterar a resposta publica e sem revelar existencia da conta.

## Validacao

O CI cobre:

- testes backend em SQLite e PostgreSQL;
- token valido, invalido, expirado e reutilizado;
- senhas divergentes;
- validadores de senha do Django;
- nao enumeracao de contas;
- testes do fluxo no frontend;
- lint, formatacao, build e validacao OpenAPI;
- smoke test do Docker Compose.
