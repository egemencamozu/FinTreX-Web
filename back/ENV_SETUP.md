# Backend Secret Configuration

Secrets kaynak kodda tutulmaz. Aşağıdaki adımları izleyerek local geliştirme ortamını kur.

---

## Ön Gereksinimler

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) kurulu olmalı
- Kontrol: `dotnet --version` → `8.x.x` çıkmalı

---

## Veritabanı

Tüm ekip aynı Azure SQL veritabanını kullanır (`appdb`).
Connection string ve şifre ekip içinde güvenli bir kanaldan (WhatsApp, Discord vb.) paylaşılır.

> Şifreyi Git'e kesinlikle koymayın.

---

## Admin Hesabı

Veritabanında zaten bir admin kullanıcısı var. Yeni kuranlar AdminSeed girmeye gerek yok.

Eğer veritabanı sıfırlandıysa ve admin kullanıcısı yeniden oluşturulması gerekiyorsa, sadece o kişi AdminSeed değerlerini girer.

---

## Local Kurulum (Herkese 1 Kez)

Komutları repo kökünden `backend/FinTreX/FinTreX.WebApi` klasörüne giderek çalıştır:

```powershell
cd backend/FinTreX/FinTreX.WebApi

# 1. User Secrets başlat (sadece ilk kurulumda)
dotnet user-secrets init

# 2. Veritabanı bağlantısı — SIFRE kısmını ekipten aldığın gerçek şifreyle değiştir
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=tcp:fintrex-sqlserver1.database.windows.net,1433;Initial Catalog=appdb;User Id=myadmin;Password=SIFRE;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

# 3. JWT anahtarı — en az 32 karakter, istediğin herhangi bir şey olabilir
dotnet user-secrets set "JWTSettings:Key" "buraya-en-az-32-karakter-uzunlugunda-bir-sey-yaz"

# 4. Şifre sıfırlama URL (frontend local adresi)
dotnet user-secrets set "PasswordResetSettings:ResetPageUrl" "http://localhost:4200/auth/reset-password"
```

---

## Migration (DB Şeması Değişince)

Birisi yeni migration eklediyse sen de çalıştırman gerekir:

```powershell
cd backend/FinTreX/FinTreX.WebApi
dotnet ef database update
```

---

## Email (Opsiyonel)

Şifre sıfırlama emaili test etmek istersen:

```powershell
dotnet user-secrets set "EmailSettings:Enabled" "true"
dotnet user-secrets set "EmailSettings:FromEmail" "gmail-adresin@gmail.com"
dotnet user-secrets set "EmailSettings:FromName" "FinTreX"
dotnet user-secrets set "EmailSettings:SmtpHost" "smtp.gmail.com"
dotnet user-secrets set "EmailSettings:SmtpPort" "587"
dotnet user-secrets set "EmailSettings:UseSsl" "true"
dotnet user-secrets set "EmailSettings:SmtpUserName" "gmail-adresin@gmail.com"
dotnet user-secrets set "EmailSettings:SmtpPassword" "gmail-app-password"
```

> Gmail App Password için: Google Hesabı → Güvenlik → 2 Adımlı Doğrulama → Uygulama Şifreleri

---

## Uygulamayı Çalıştır

```powershell
cd backend/FinTreX/FinTreX.WebApi
dotnet run
```

Swagger: https://localhost:9001/swagger

---

## Production

Production ortamında sırlar Azure App Service → Configuration panelinden environment variable olarak girilir. Kod içinde ya da git'te bulunmaz.

| Key | Açıklama |
|-----|----------|
| `ConnectionStrings__DefaultConnection` | Production Azure SQL connection string (Managed Identity, şifre gerekmez) |
| `JWTSettings__Key` | Güçlü random JWT anahtarı |
| `AdminSeed__Email` | Admin kullanıcı emaili |
| `AdminSeed__Password` | Admin kullanıcı şifresi |
| `EmailSettings__SmtpPassword` | SMTP şifresi |
| `PasswordResetSettings__ResetPageUrl` | Frontend reset sayfası URL |
