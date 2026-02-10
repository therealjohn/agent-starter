@description('Location for all resources')
param location string

@description('Tags for all resources')
param tags object

@description('Unique resource token')
param resourceToken string

@description('Entra ID principal (user) object ID for local dev RBAC')
param principalId string = ''

@description('Skip session pool creation')
param skipSessionPool bool = true

@secure()
@description('Anthropic API key')
param anthropicApiKey string = ''

@description('Maximum concurrent sessions')
param maxConcurrentSessions int = 10

@description('Ready session instances')
param readySessionInstances int = 5

// ──────────────────────────────────────────────
// User-Assigned Managed Identity
// ──────────────────────────────────────────────
resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-agent-${resourceToken}'
  location: location
  tags: tags
}

// ──────────────────────────────────────────────
// Log Analytics
// ──────────────────────────────────────────────
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-agent-${resourceToken}'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// ──────────────────────────────────────────────
// Azure Container Registry
// ──────────────────────────────────────────────
resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  name: 'acragent${resourceToken}'
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false
  }
}

// AcrPull role for managed identity
resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: containerRegistry
  name: guid(containerRegistry.id, managedIdentity.id, '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ──────────────────────────────────────────────
// Container Apps Environment
// ──────────────────────────────────────────────
resource containerAppsEnv 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-agent-${resourceToken}'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

// ──────────────────────────────────────────────
// Dynamic Session Pool (custom container)
// Only created when skipSessionPool is false (image must exist in ACR first)
// ──────────────────────────────────────────────
resource sessionPool 'Microsoft.App/sessionPools@2024-08-02-preview' = if (!skipSessionPool) {
  name: 'sp-agent-${resourceToken}'
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {}
    }
  }
  properties: {
    environmentId: containerAppsEnv.id
    poolManagementType: 'Dynamic'
    containerType: 'CustomContainer'
    workloadProfileName: 'Consumption'
    scaleConfiguration: {
      maxConcurrentSessions: maxConcurrentSessions
      readySessionInstances: readySessionInstances
    }
    dynamicPoolConfiguration: {
      cooldownPeriodInSeconds: 300
    }
    customContainerTemplate: {
      registryCredentials: {
        server: containerRegistry.properties.loginServer
        identity: managedIdentity.id
      }
      containers: [
        {
          image: '${containerRegistry.properties.loginServer}/session-executor:latest'
          name: 'session-executor'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      ingress: {
        targetPort: 8080
      }
    }
    sessionNetworkConfiguration: {
      status: 'EgressEnabled'
    }
    managedIdentitySettings: [
      {
        identity: managedIdentity.id
        lifecycle: 'Main'
      }
    ]
  }
  dependsOn: [
    acrPullRole
  ]
}

// Session Executor role for managed identity on session pool
resource sessionExecutorRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!skipSessionPool) {
  name: guid(sessionPool.id, managedIdentity.id, '0fb8eba5-a2bb-4abe-b1c1-49dfad359bb0')
  scope: sessionPool
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '0fb8eba5-a2bb-4abe-b1c1-49dfad359bb0')
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Session Executor role for deploying user (local dev)
resource sessionExecutorLocalRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!skipSessionPool && !empty(principalId)) {
  name: guid(sessionPool.id, principalId, 'local-session-executor')
  scope: sessionPool
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '0fb8eba5-a2bb-4abe-b1c1-49dfad359bb0')
    principalId: principalId
    principalType: 'User'
  }
}

// ──────────────────────────────────────────────
// Container App (agent-starter-api)
// ──────────────────────────────────────────────
resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-agent-${resourceToken}'
  location: location
  tags: union(tags, { 'azd-service-name': 'agent-starter-api' })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        corsPolicy: {
          allowedOrigins: ['*']
          allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
          allowedHeaders: ['*']
        }
      }
      registries: [
        {
          server: containerRegistry.properties.loginServer
          identity: managedIdentity.id
        }
      ]
      secrets: [
        {
          name: 'anthropic-api-key'
          value: anthropicApiKey
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'agent-starter-api'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'
          resources: {
            cpu: json('1')
            memory: '2Gi'
          }
          env: [
            {
              name: 'ANTHROPIC_API_KEY'
              secretRef: 'anthropic-api-key'
            }
            {
              name: 'SESSION_STRATEGY'
              value: 'azure'
            }
            {
              name: 'AZURE_CLIENT_ID'
              value: managedIdentity.properties.clientId
            }
            {
              name: 'AZURE_SESSION_POOL_ENDPOINT'
              value: (!skipSessionPool) ? sessionPool.properties.poolManagementEndpoint : ''
            }
            {
              name: 'SESSION_POOL_AUDIENCE'
              value: 'https://dynamicsessions.io/.default'
            }
            {
              name: 'API_PORT'
              value: '3000'
            }
          ]
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 10
      }
    }
  }
  dependsOn: [
    acrPullRole
  ]
}

// ──────────────────────────────────────────────
// Outputs
// ──────────────────────────────────────────────
output containerRegistryEndpoint string = containerRegistry.properties.loginServer
output containerAppUri string = 'https://${containerApp.properties.configuration.ingress.fqdn}'
output sessionPoolEndpoint string = (!skipSessionPool) ? sessionPool.properties.poolManagementEndpoint : ''
output sessionPoolName string = (!skipSessionPool) ? sessionPool.name : ''
