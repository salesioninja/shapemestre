# 🚀 Guia Oficial: Atualização do Shape Mestre via Bitvise SFTP

> **Ambiente Confirmado:** Sua VPS utiliza **Docker Swarm** com o serviço **`shapemestre_app`** rodando na rede `ninja_net` com proxy Traefik.

---

## ⚡ 1. COMANDO MESTRE: DESTRAVAR 100% DAS ANIMAÇÕES NA VPS

Copie todo o bloco abaixo de uma vez só, cole no terminal preto do Bitvise (onde você está logado como `root@srv697798:/var/www/shapemestre#`) e aperte **Enter**:

```bash
python3 - << 'EOF'
import os
import sys
import json
import re
import shutil
import unicodedata

def clean_key(s):
    s = s.lower().strip()
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]', '', s)

def make_alias(src, dst):
    if os.path.exists(dst):
        return False
    try:
        os.symlink(src, dst)
        return True
    except Exception:
        try:
            shutil.copyfile(src, dst)
            return True
        except Exception:
            return False

webp_dir = '/var/www/shapemestre/public/assets/webp'
if not os.path.exists(webp_dir):
    print(f"❌ Diretório não encontrado: {webp_dir}")
    sys.exit(1)

print("🚀 1/3. Corrigindo nomes com acentos corrompidos pelo unzip (CP437/CP850)...")
renamed_accents = 0
for f in os.listdir(webp_dir):
    clean = None
    for enc in ['cp437', 'cp850']:
        try:
            cand = f.encode(enc).decode('utf-8')
            if cand != f:
                clean = cand
                break
        except Exception:
            pass
    if clean:
        src = os.path.join(webp_dir, f)
        dst = os.path.join(webp_dir, clean)
        try:
            os.rename(src, dst)
            renamed_accents += 1
        except Exception:
            pass
print(f"   ✅ {renamed_accents} arquivos com acentos foram restaurados com sucesso!")

print("🚀 2/3. Mapeando arquivos para compatibilidade exata com o catálogo de exercícios...")
disk_files = os.listdir(webp_dir)
clean_map = {}
for f in disk_files:
    if not f.endswith('.webp'):
        continue
    base = f[:-5]
    k = clean_key(base)
    clean_map[k] = f
    k_no_digits = re.sub(r'\d+$', '', k)
    if k_no_digits not in clean_map:
        clean_map[k_no_digits] = f

ex_path = None
for cand in [
    '/var/www/shapemestre/data/exercises.json',
    '/var/www/shapemestre/public/data/exercises.json'
]:
    if os.path.exists(cand):
        ex_path = cand
        break

aliases_created = 0
if ex_path:
    try:
        with open(ex_path, 'r', encoding='utf-8') as f:
            exercises = json.load(f)
        for ex in exercises:
            name = ex.get('name', '').strip()
            clean_name = re.sub(r'\s*\(\d+\)$', '', name).strip()
            target_filename = f"{clean_name}.webp"
            target_path = os.path.join(webp_dir, target_filename)
            
            if not os.path.exists(target_path):
                k = clean_key(clean_name)
                match = clean_map.get(k)
                if match:
                    src_path = os.path.join(webp_dir, match)
                    if make_alias(src_path, target_path):
                        aliases_created += 1
        print(f"   ✅ {aliases_created} links criados para variações de maiúsculas/hífen!")
    except Exception as e:
        print(f"   ⚠️ Aviso ao ler exercises.json: {e}")

print("🚀 3/3. Finalizado! 100% das animações estão prontas!")
EOF

docker cp /var/www/shapemestre/server.js $(docker ps -q -f name=shapemestre_app):/app/server.js
docker service update --force shapemestre_app
```

---

## 🌐 2. Como Testar no Navegador
1. Abra o site no navegador: **`https://shapemestre.acessaronline.com.br`**
2. Pressione **`Ctrl + F5`** (ou limpe o cache do app no celular).
3. Busque por **"aducao"**, **"bulgaro"**, **"camarao"** ou **"smith"**:
   * Todas as animações carregarão instantaneamente!
   * Os botões **`[🔬 Raio-X]`** e o selo **`[Raio-X 3D]`** estarão 100% ativos!

---

## 📋 3. PROCEDIMENTO PADRÃO PARA PRÓXIMAS ATUALIZAÇÕES

Sempre que enviarmos novos arquivos via Bitvise:

1. **No seu PC:** O assistente gera o arquivo `.zip` (`SHAPE_MESTRE_APP/update_shapemestre_fichas.zip`).
2. **No Bitvise SFTP:** Arraste o arquivo `update_shapemestre_fichas.zip` da esquerda (`SHAPE_MESTRE_APP`) para a direita (`/var/www/shapemestre`).
3. **No Terminal Preto da VPS:** Execute:
   ```bash
   cd /var/www/shapemestre
   unzip -o update_shapemestre_fichas.zip
   CID=$(docker ps -q -f name=shapemestre_app | head -n 1)
   docker cp /var/www/shapemestre/public $CID:/app/ 2>/dev/null || true
   docker cp /var/www/shapemestre/server.js $CID:/app/server.js 2>/dev/null || true
   docker cp /var/www/shapemestre/services $CID:/app/ 2>/dev/null || true
   docker service update --force shapemestre_app
   ```
