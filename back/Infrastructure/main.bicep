// ============================================================
// Azure Bicep - Web App (westeurope) + Azure SQL (eastus)
// ============================================================
// Deployment:
//   az deployment group create \
//     --resource-group fintrex-rg \
//     --template-file main.bicep \
//     --parameters sqlAdminLogin=myadmin sqlAdminPassword="FinTreX.123!"
// ============================================================

@description('Proje adı')
param projectName string = 'fintrex'

@description('SQL Server admin kullanıcı adı')
param sqlAdminLogin string

@secure()
@description('SQL Server admin şifresi')
param sqlAdminPassword string

@description('SQL Database adı')
param sqlDatabaseName string = 'appdb'

// ------------------------------------------------------------
// Bölge Ayarları
// ------------------------------------------------------------
var appLocation = 'westeurope'    // Web App — burada B1 kotası var
var sqlLocation = 'centralus'     // SQL — bu bölgede kısıtlama yok

// ------------------------------------------------------------
// Değişkenler
// ------------------------------------------------------------
var appServicePlanName = '${projectName}-plan'
var webAppName = '${projectName}-api'
var sqlServerName = '${projectName}-sqlserver1'

// ------------------------------------------------------------
// 1) App Service Plan (B1 — Linux)
// ------------------------------------------------------------
resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: appLocation
  kind: 'linux'
  properties: {
    reserved: true
  }
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
}

// ------------------------------------------------------------
// 2) Web App (.NET 8 — Linux)
// ------------------------------------------------------------
resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: webAppName
  location: appLocation
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|8.0'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'ASPNETCORE_ENVIRONMENT'
          value: 'Production'
        }
      ]
      connectionStrings: [
        {
          name: 'DefaultConnection'
          connectionString: 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Initial Catalog=${sqlDatabaseName};Persist Security Info=False;User ID=${sqlAdminLogin};Password=${sqlAdminPassword};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;'
          type: 'SQLAzure'
        }
      ]
    }
  }
}

// ------------------------------------------------------------
// 3) Azure SQL Server
// ------------------------------------------------------------
resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: sqlServerName
  location: sqlLocation
  properties: {
    administratorLogin: sqlAdminLogin
    administratorLoginPassword: sqlAdminPassword
    version: '12.0'
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

// ------------------------------------------------------------
// 4) SQL Server Firewall — Azure Servislerine Erişim
// ------------------------------------------------------------
resource sqlFirewallAllowAzure 'Microsoft.Sql/servers/firewallRules@2023-08-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// ------------------------------------------------------------
// 5) Azure SQL Database (Free Tier — Serverless)
// ------------------------------------------------------------
resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: sqlDatabaseName
  location: sqlLocation
  sku: {
    name: 'GP_S_Gen5_1'
    tier: 'GeneralPurpose'
    family: 'Gen5'
    capacity: 1
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 34359738368
    autoPauseDelay: 60
    minCapacity: json('0.5')
    zoneRedundant: false
    requestedBackupStorageRedundancy: 'Local'
    useFreeLimit: true
    freeLimitExhaustionBehavior: 'AutoPause'
  }
}

// ------------------------------------------------------------
// Çıktılar
// ------------------------------------------------------------
output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
output webAppName string = webApp.name
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output sqlDatabaseName string = sqlDatabase.name
