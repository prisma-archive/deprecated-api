/* @flow */

import {
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLID,
  GraphQLObjectType,
  GraphQLNonNull,
  GraphQLInterfaceType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLList
} from 'graphql'

import GraphQLDateTime from './GraphQLDateTime.js'

import {
  connectionDefinitions,
  connectionArgs,
  connectionFromArray,
  toGlobalId,
  fromGlobalId
} from 'graphql-relay'

import {
  mapArrayToObject
} from '../utils/array.js'

import {
  mergeObjects
} from '../utils/object.js'

import {
  isScalar,
  convertInputFieldsToInternalIds,
  externalIdFromQueryInfo,
  ensureIsList
} from '../utils/graphql.js'

import type {
  ClientSchema,
  ClientSchemaField,
  ClientTypes,
  AllTypes,
  GraphQLFields,
  SchemaType,
  Relation
} from '../utils/definitions.js'

function getFilterPairsFromFilterArgument (filter) {
  if (!filter) {
    return []
  }

  var filters = []
  for (const field in filter) {
    if (filter[field] != null) {
      filters.push({ field, value: filter[field] })
    }
  }

  return filters
}

function injectRelationships (
  objectType: GraphQLObjectType,
  clientSchema: ClientSchema,
  allClientTypes: ClientTypes,
  schemaType: SchemaType
): void {
  const objectTypeFields = objectType._typeConfig.fields

  clientSchema.fields
    .filter((field) => objectTypeFields[field.fieldName].type.__isRelation)
    .forEach((clientSchemaField: ClientSchemaField) => {
      const fieldName = clientSchemaField.fieldName
      const objectTypeField = objectTypeFields[fieldName]
      const typeIdentifier = objectTypeField.type.typeIdentifier

      // 1:n relationship
      if (clientSchemaField.isList) {
        objectTypeField.type = schemaType === 'RELAY'
          ? allClientTypes[typeIdentifier].connectionType
          : new GraphQLList(allClientTypes[typeIdentifier].objectType)
        objectTypeField.args = allClientTypes[typeIdentifier].queryFilterInputArguments

        objectTypeField.resolve = (obj, args, { operation, rootValue: { currentUser, backend } }) => {
          if (args.filter) {
            args.filter = convertInputFieldsToInternalIds(args.filter, allClientTypes[typeIdentifier].clientSchema)
          }

          return backend.allNodesByRelation(
            clientSchema.modelName,
            obj.id,
            clientSchemaField.fieldName,
            args,
            allClientTypes[typeIdentifier].clientSchema,
            currentUser,
            allClientTypes[clientSchema.modelName].clientSchema)
            .then(({array, hasMorePages}) => {
              if (schemaType === 'RELAY') {
                const edges = array.map((item) => ({node: item, cursor: toGlobalId(args.orderBy || 'id_ASC', item.id)}))
                const pageInfo = {
                  hasNextPage: hasMorePages,
                  hasPreviousPage: false,
                  startCursor: edges[0] ? edges[0].cursor : null,
                  endCursor: edges[edges.length-1] ? edges[edges.length-1].cursor : null
                }
                return {
                  edges,
                  pageInfo,
                  totalCount: array.length
                }
              } else {
                return array
              }
            })
        }

      // 1:1 relationship
      } else {
        objectTypeField.type = allClientTypes[typeIdentifier].objectType
        objectTypeField.resolve = (obj, args, { operation, rootValue: { backend, currentUser } }) => (
          backend.allNodesByRelation(
            clientSchema.modelName,
            obj.id,
            fieldName,
            args,
            allClientTypes[typeIdentifier].clientSchema,
            currentUser,
            allClientTypes[clientSchema.modelName].clientSchema)
          .then(({array}) => {
            return array[0]
          })
        )
      }
    })
}

function wrapWithNonNull (
  objectType: GraphQLObjectType,
  clientSchema: ClientSchema
): void {
  clientSchema.fields
    .filter((field) => field.isRequired)
    .forEach((clientSchemaField: ClientSchemaField) => {
      const fieldName = clientSchemaField.fieldName
      const objectTypeField = objectType._typeConfig.fields[fieldName]
      objectTypeField.type = new GraphQLNonNull(objectTypeField.type)
    })
}

export function createTypes (clientSchemas: [ClientSchema], relations: [Relation], schemaType: SchemaType): AllTypes {
  const enumTypes = {}
  function parseClientType (field: ClientSchemaField, modelName: string) {
    const listify = field.isList ? (type) => new GraphQLList(type) : (type) => type
    switch (field.typeIdentifier) {
      case 'String': return listify(GraphQLString)
      case 'Boolean': return listify(GraphQLBoolean)
      case 'Int': return listify(GraphQLInt)
      case 'Float': return listify(GraphQLFloat)
      case 'GraphQLID': return listify(GraphQLID)
      case 'Password': return listify(GraphQLString)
      case 'DateTime': return listify(GraphQLDateTime)
      case 'Enum' :
        const enumTypeName = `${modelName}_${field.fieldName}`
        if (!enumTypes[enumTypeName]) {
          enumTypes[enumTypeName] = new GraphQLEnumType({
            name: enumTypeName,
            values: mapArrayToObject(field.enumValues, (x) => x, (x) => ({value: x}))
          })
        }

        return listify(enumTypes[enumTypeName])
      // NOTE this marks a relation type which will be overwritten by `injectRelationships`
      default: return { __isRelation: true, typeIdentifier: field.typeIdentifier }
    }
  }

  function hasDefaultValue (field) {
    return field.defaultValue !== undefined && field.defaultValue !== null
  }

  function getValueOrDefault (obj, field) {
    if (obj[field.fieldName] !== undefined && obj[field.fieldName] !== null) {
      return obj[field.fieldName]
    } else {
      if (hasDefaultValue(field)) {
        return field.defaultValue
      } else {
        return null
      }
    }
  }

  function generateDescription (field) {
    const defaultValue = field.defaultValue !== undefined ? `**Default value: '${field.defaultValue}'**` : ''
    const description =
    // note: this is markdown syntax...
    `${defaultValue}

    ${field.description || ''}`

    return description
  }

  function generateObjectType (
    clientSchema: ClientSchema,
    NodeInterfaceType: GraphQLInterfaceType
  ): GraphQLObjectType {
    const graphQLFields: GraphQLFields = mapArrayToObject(
      clientSchema.fields,
      (field) => field.fieldName,
      (field) => {
        const type = parseClientType(field, clientSchema.modelName)
        const resolve = field.fieldName === 'id'
          ? (obj) => toGlobalId(clientSchema.modelName, getValueOrDefault(obj, field))
          : (obj) => field.isList ? ensureIsList(getValueOrDefault(obj, field)) : getValueOrDefault(obj, field)

        return {type, resolve, description: generateDescription(field)}
      }
    )

    return new GraphQLObjectType({
      name: clientSchema.modelName,
      fields: graphQLFields,
      interfaces: [NodeInterfaceType]
    })
  }

  function generateUniqueQueryInputArguments (clientSchema: ClientSchema) {
    const fields = clientSchema.fields.filter((field) => field.isUnique && !field.isList)
    return mapArrayToObject(
      fields,
      (field) => field.fieldName,
      (field) => ({
        type: parseClientType(field, clientSchema.modelName),
        description: generateDescription(field)
      })
    )
  }

  function generateObjectMutationInputArguments (
    clientSchema: ClientSchema,
    scalarFilter: (field: ClientSchemaField) => boolean,
    oneToOneFilter: (field: ClientSchemaField) => boolean,
    forceFieldsOptional: boolean = false,
    forceIdFieldOptional: boolean = false,
    allowDefaultValues: boolean = true
  ): GraphQLObjectType {
    function isRequired (field) {
      if (!field.isRequired) {
        return false
      }

      if (field.fieldName === 'id' && forceIdFieldOptional) {
        return false
      }

      if (field.fieldName !== 'id' && forceFieldsOptional) {
        return false
      }

      if (hasDefaultValue(field)) {
        return false
      }

      return true
    }

    const scalarFields = clientSchema.fields.filter(scalarFilter)
    const scalarArguments = mapArrayToObject(
      scalarFields,
      (field) => field.fieldName,
      (field) => ({
        type: isRequired(field)
          ? new GraphQLNonNull(parseClientType(field, clientSchema.modelName))
          : parseClientType(field, clientSchema.modelName),
        description: generateDescription(field),
        defaultValue: field.defaultValue !== undefined && allowDefaultValues ? field.defaultValue : null
      })
    )

    const onetoOneFields = clientSchema.fields.filter(oneToOneFilter)
    const oneToOneArguments = mapArrayToObject(
      onetoOneFields,
      (field) => `${field.fieldName}Id`,
      (field) => ({
        type: (field.isRequired && !forceFieldsOptional) ? new GraphQLNonNull(GraphQLID) : GraphQLID,
        description: generateDescription(field),
        defaultValue: field.defaultValue !== undefined && allowDefaultValues ? field.defaultValue : null
      }))

    return mergeObjects(scalarArguments, oneToOneArguments)
  }

  function generateCreateObjectMutationInputArguments (
    clientSchema: ClientSchema
  ): GraphQLObjectType {
    return generateObjectMutationInputArguments(
      clientSchema,
      (field) => !parseClientType(field, clientSchema.modelName).__isRelation && field.fieldName !== 'id',
      (field) => parseClientType(field, clientSchema.modelName).__isRelation && !field.isList,
      false
    )
  }

  function generateUpdateObjectMutationInputArguments (
    clientSchema: ClientSchema
  ): GraphQLObjectType {
    return generateObjectMutationInputArguments(
      clientSchema,
      (field) => !parseClientType(field, clientSchema.modelName).__isRelation,
      (field) => parseClientType(field, clientSchema.modelName).__isRelation && !field.isList,
      true
    )
  }

  const simpleConnectionArgs = {
    skip: {
      type: GraphQLInt
    },
    take: {
      type: GraphQLInt
    }
  }

  function generateQueryFilterInputArguments (
    clientSchema: ClientSchema
  ): GraphQLObjectType {
    const args = generateObjectMutationInputArguments(
      clientSchema,
      (field) => !parseClientType(field, clientSchema.modelName).__isRelation,
      (field) => parseClientType(field, clientSchema.modelName).__isRelation && !field.isList,
      true,
      true,
      false
    )

    return mergeObjects(
      schemaType === 'RELAY' ? connectionArgs : simpleConnectionArgs,
      {
        filter: {
          type: new GraphQLInputObjectType({
            name: `${clientSchema.modelName}Filter`,
            fields: args
          })
        },
        orderBy: {
          type: generateQueryOrderByEnum(clientSchema)
        }
      }
    )
  }

  function generateQueryOrderByEnum (
    clientSchema: ClientSchema
  ): GraphQLEnumType {
    const values = []
    clientSchema.fields.filter((field) => isScalar(field.typeIdentifier)).forEach((field) => {
      values.push(`${field.fieldName}_ASC`)
      values.push(`${field.fieldName}_DESC`)
    })
    return new GraphQLEnumType({
      name: `${clientSchema.modelName}SortBy`,
      values: mapArrayToObject(values, (x) => x, (x) => ({value: x}))
    })
  }

  function patchRelations (clientSchema: ClientSchema) : ClientSchema {
    clientSchema.fields.forEach((field) => {
      if (field.relationId !== null) {
        field.relation = relations.filter((relation) => relation.id === field.relationId)[0]
      }
    })

    return clientSchema
  }

  const clientTypes: ClientTypes = {}

  const NodeInterfaceType = new GraphQLInterfaceType({
    name: 'NodeInterface',
    fields: () => ({
      id: { type: GraphQLID }
    }),
    resolveType: (node, info) => {
      const externalId = externalIdFromQueryInfo(info)
      const {type} = fromGlobalId(externalId)
      return clientTypes[type].objectType
    }
  })

  // generate object types without relationships properties since we need all of the object types first
  mapArrayToObject(
    clientSchemas,
    (clientSchema) => clientSchema.modelName,
    (clientSchema) => {
      const objectType = generateObjectType(clientSchema, NodeInterfaceType)
      const { connectionType, edgeType } = connectionDefinitions({
        name: clientSchema.modelName,
        nodeType: objectType,
        connectionFields: () => ({
          totalCount: {
            type: GraphQLInt,
            resolve: (conn) => conn.totalCount
          }
        })
      })
      const createMutationInputArguments = generateCreateObjectMutationInputArguments(clientSchema)
      const updateMutationInputArguments = generateUpdateObjectMutationInputArguments(clientSchema)
      const queryFilterInputArguments = generateQueryFilterInputArguments(clientSchema)
      const uniqueQueryInputArguments = generateUniqueQueryInputArguments(clientSchema)
      clientSchema = patchRelations(clientSchema)
      return {
        clientSchema,
        objectType,
        connectionType,
        edgeType,
        createMutationInputArguments,
        updateMutationInputArguments,
        queryFilterInputArguments,
        uniqueQueryInputArguments
      }
    },
    clientTypes
  )

  // set relationship properties
  for (const modelName in clientTypes) {
    injectRelationships(
      clientTypes[modelName].objectType,
      clientTypes[modelName].clientSchema,
      clientTypes,
      schemaType
    )
  }

  // set nullable properties
  for (const modelName in clientTypes) {
    wrapWithNonNull(
      clientTypes[modelName].objectType,
      clientTypes[modelName].clientSchema
    )
  }

  const viewerFields = {}
  for (const modelName in clientTypes) {
    viewerFields[`all${modelName}s`] = {
      type: schemaType === 'RELAY'
        ? clientTypes[modelName].connectionType
        : new GraphQLList(clientTypes[modelName].objectType),
      args: clientTypes[modelName].queryFilterInputArguments,
      resolve: (_, args, { operation, rootValue: { currentUser, backend } }) => {
        return backend.allNodesByType(modelName, args, clientTypes[modelName].clientSchema, currentUser, operation)
          .then(({array, hasMorePages}) => {
            if (schemaType === 'RELAY') {
              const edges = array.map((item) => ({node: item, cursor: toGlobalId(args.orderBy || 'id_ASC', item.id)}))
              const pageInfo = {
                hasNextPage: hasMorePages,
                hasPreviousPage: false,
                startCursor: edges[0] ? edges[0].cursor : null,
                endCursor: edges[edges.length-1] ? edges[edges.length-1].cursor : null
              }
              return {
                edges,
                pageInfo,
                totalCount: array.length
              }
            } else {
              return array
            }
          })
      }
    }
  }

  viewerFields.id = {
    type: GraphQLID,
    resolve: (obj) => toGlobalId('User', obj.id)
  }

  if (clientTypes.User) {
    viewerFields.user = {
      type: clientTypes.User.objectType,
      resolve: (_, args, { rootValue: { backend } }) => (
        backend.user()
      )
    }
  }

  const viewerType = new GraphQLObjectType({
    name: 'Viewer',
    fields: viewerFields,
    interfaces: [NodeInterfaceType]
  })

  return {clientTypes, NodeInterfaceType, viewerType, viewerFields}
}
