# Instruções: Como subir seu CRM para o GitHub e Nuvem 🚀

Você agora tem a versão **Cash Machine Cloud**, que salva tudo diretamente no seu repositório do GitHub em um arquivo JSON.

### Passo 1: Criar o Repositório no GitHub
1. Vá ao seu GitHub e crie um novo repositório (pode ser privado) chamado, por exemplo, `cash-machine-crm`.
2. **Não** inicialize com README nem .gitignore (eu já criei esses arquivos para você).

### Passo 2: Gerar seu Token de Acesso (PAT)
O CRM precisa de permissão para "escrever" o banco de dados no seu GitHub.
1. No GitHub, clique na sua foto (topo direito) > **Settings**.
2. No menu lateral esquerdo, lá no final, clique em **Developer Settings**.
3. Clique em **Personal access tokens** > **Tokens (classic)**.
4. Clique em **Generate new token (classic)**.
5. Nomeie como "CRM Access" e marque a caixinha **'repo'** (isso dá permissão para salvar os arquivos).
6. Clique em **Generate token** e **COPIE** o código que aparecer. (Você não verá ele de novo).

### Passo 3: Subir o Código
Abra o terminal na pasta `premium-crm-cloud` e rode os comandos:
```bash
git add .
git commit -m "Cash Machine Cloud: Initial Setup"
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

### Passo 4: Colocar "Ao Vivo" na Vercel (Opcional, mas Recomendado)
Para acessar de qualquer lugar (celular/tablet):
1. Vá em [Vercel.com](https://vercel.com) e conecte seu GitHub.
2. Importe o projeto `cash-machine-crm`.
3. **IMPORTANTE**: Em "Environment Variables", adicione as 3 chaves do arquivo `.env.example`:
   - `GITHUB_TOKEN`: (O token que você gerou no Passo 2)
   - `GITHUB_REPO`: `seu_usuario/seu_repositorio`
   - `GITHUB_BRANCH`: `main`
4. Clique em **Deploy**.

---

### Como funciona o Banco de Dados?
- Seus dados estão em `data/database.json`.
- Toda vez que você altera algo no CRM, o sistema faz um "commit" automático.
- No seu GitHub, você verá o histórico de todas as alterações que você fez no CRM como se fossem edições de código!

**Divirta-se com seu novo CRM 100% autônomo na nuvem!**
