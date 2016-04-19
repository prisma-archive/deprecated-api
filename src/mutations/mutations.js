/* @flow */

import type {
  GraphQLFields,
  AllTypes,
  SchemaType
} from '../utils/definitions.js'

import { isScalar } from '../utils/graphql.js'
import signinUser from './signinUser'
import createNode from './create'
import updateNode from './update'
import deleteNode from './delete'
import addToConnection from './addToConnection'
import removeFromConnection from './removeFromConnection'

export function createMutationEndpoints (
  input: AllTypes,
  schemaType: SchemaType
): GraphQLFields {
  const fields = {}
  const clientTypes = input.clientTypes
  const viewerType = input.viewerType

  fields.signinUser = signinUser(viewerType)

  for (const modelName in clientTypes) {
    fields[`create${modelName}`] = createNode(viewerType, clientTypes, modelName, schemaType)
    fields[`update${modelName}`] = updateNode(viewerType, clientTypes, modelName, schemaType)
    fields[`delete${modelName}`] = deleteNode(viewerType, clientTypes, modelName, schemaType)

    clientTypes[modelName].clientSchema.fields
    .filter((field) => field.isList && !isScalar(field.typeIdentifier))
    .forEach((connectionField) => {
      fields[`add${connectionField.typeIdentifier}To${connectionField.fieldName}ConnectionOn${modelName}`] =
        addToConnection(viewerType, clientTypes, modelName, connectionField, schemaType)

      fields[`remove${connectionField.typeIdentifier}From${connectionField.fieldName}ConnectionOn${modelName}`] =
        removeFromConnection(viewerType, clientTypes, modelName, connectionField, schemaType)
    })
  }

  return fields
}
