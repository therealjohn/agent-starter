targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

@description('Entra ID principal (user) object ID for local dev RBAC')
param principalId string = ''

@description('Skip session pool creation (used during first provision before image exists in ACR)')
param skipSessionPool bool = true

@secure()
@description('Anthropic API key for Claude Agent SDK')
param anthropicApiKey string = ''

@description('Maximum concurrent sessions for the session pool')
param maxConcurrentSessions int = 10

@description('Number of ready session instances to maintain in the pool')
param readySessionInstances int = 5

// Tags applied to all resources
var tags = {
  'azd-env-name': environmentName
  project: 'agent-starter'
}

var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))

// Resource Group
resource rg 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

// All resources deployed at resource-group scope
module resources 'resources.bicep' = {
  name: 'resources'
  scope: rg
  params: {
    location: location
    tags: tags
    resourceToken: resourceToken
    principalId: principalId
    skipSessionPool: skipSessionPool
    anthropicApiKey: anthropicApiKey
    maxConcurrentSessions: maxConcurrentSessions
    readySessionInstances: readySessionInstances
  }
}

// Outputs — auto-populate .azure/<env>/.env
output AZURE_LOCATION string = location
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = resources.outputs.containerRegistryEndpoint
output SERVICE_AGENT_STARTER_API_URI string = resources.outputs.containerAppUri
output AZURE_SESSION_POOL_ENDPOINT string = resources.outputs.sessionPoolEndpoint
output AZURE_SESSION_POOL_NAME string = resources.outputs.sessionPoolName
