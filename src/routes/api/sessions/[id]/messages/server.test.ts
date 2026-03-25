import '../../../../../tests/use-native-fetch'
import { mock } from 'bun:test'
import { defineMessagesRouteTests } from '../../../../../tests/messages-route-tests'

void mock.module('$lib/server/notify', () => ({
  notifySessionHub: mock(async () => {})
}))

const { GET, POST } = await import('./+server')

defineMessagesRouteTests({
  GET,
  POST,
  authKey: 'apiUser',
  insertRole: 'assistant',
  routePrefix: '/api/sessions'
})
