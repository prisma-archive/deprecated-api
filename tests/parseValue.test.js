import chai from 'chai'
const { assert } = chai

import { parseValue, isValidValueForType } from '../src/utils/graphql.js'

describe('parseValue', () => {
  it('should parse string', () => {
    return Promise.all([
      assert.equal(parseValue('aaa', 'String'), 'aaa'),
      assert.equal(isValidValueForType('aaa', 'String'), true)
    ])
  })

  it('should parse Boolean', () => {
    return Promise.all([
      assert.equal(parseValue('True', 'Boolean'), true),
      assert.equal(parseValue('true', 'Boolean'), true),
      assert.equal(parseValue('False', 'Boolean'), false),
      assert.equal(parseValue('false', 'Boolean'), false),
      assert.equal(parseValue('TRUE', 'Boolean'), null),
      assert.equal(isValidValueForType('true', 'Boolean'), true),
      assert.equal(isValidValueForType('horse', 'Boolean'), false)
    ])
  })

  it('should parse Int', () => {
    return Promise.all([
      assert.equal(parseValue('1', 'Int'), 1),
      assert.equal(parseValue('one', 'Int'), null),
      assert.equal(isValidValueForType('1', 'Int'), true),
      assert.equal(isValidValueForType('one', 'Int'), false)
    ])
  })

  it('should parse Float', () => {
    return Promise.all([
      assert.equal(parseValue('1', 'Float'), 1),
      assert.equal(parseValue('1.4', 'Float'), 1.4),
      assert.equal(parseValue('thousands', 'Float'), null),
      assert.equal(isValidValueForType('1.4', 'Float'), true),
      assert.equal(isValidValueForType('one', 'Float'), false)
    ])
  })

  it('should parse GraphQLID', () => {
    return Promise.all([
      assert.equal(parseValue('some id', 'GraphQLID'), 'some id'),
      assert.equal(parseValue('1.4', 'GraphQLID'), 1.4),
      assert.equal(isValidValueForType('1.4', 'GraphQLID'), true)
    ])
  })

  it('should parse Password', () => {
    return Promise.all([
      assert.equal(parseValue('some password', 'Password'), 'some password'),
      assert.equal(parseValue('1.4', 'Password'), 1.4),
      assert.equal(isValidValueForType('1.4', 'Password'), true)
    ])
  })

  it('should parse Enum', () => {
    return Promise.all([
      assert.equal(parseValue('SOME_ENUM', 'Enum'), 'SOME_ENUM'),
      assert.equal(parseValue('1.4', 'Enum'), null),
      assert.equal(isValidValueForType('1.4', 'Enum'), false),
      assert.equal(isValidValueForType('NAME', 'Enum'), true)
    ])
  })

  it('should parse DateTime', () => {
    return Promise.all([
      assert.equal(isValidValueForType('', 'DateTime'), false),
      assert.equal(isValidValueForType('now', 'DateTime'), false),
      assert.equal(isValidValueForType('Thu, 19 May 2016 21:09:24 +02:00', 'DateTime'), false),
      assert.equal(isValidValueForType('Thu, 19 May 2016', 'DateTime'), false),

      assert.equal(isValidValueForType('2016', 'DateTime'), true),
      assert.equal(isValidValueForType('2016-01', 'DateTime'), true),
      assert.equal(isValidValueForType('2016-01-01', 'DateTime'), true),
      assert.equal(isValidValueForType('2016-01-01T', 'DateTime'), true),
      assert.equal(isValidValueForType('2016-05-19T17', 'DateTime'), true),
      assert.equal(isValidValueForType('2016-05-19T17:09', 'DateTime'), true),
      assert.equal(isValidValueForType('2016-05-19T17:09:24', 'DateTime'), true),
      assert.equal(isValidValueForType('2016-01-01T17:09:24+02:00', 'DateTime'), true),
      assert.equal(isValidValueForType('2016-05-19T17:09:24Z', 'DateTime'), true),
      assert.equal(isValidValueForType('2016-05-19T17:09:24.1', 'DateTime'), true),
      assert.equal(isValidValueForType('2016-05-19T17:09:24.12', 'DateTime'), true),
      assert.equal(isValidValueForType('2016-05-19T17:09:24.123', 'DateTime'), true),
      assert.equal(isValidValueForType('2016-05-19T17:09:24.1234', 'DateTime'), true),
      assert.equal(isValidValueForType('2016-05-19T17:09:24.1Z', 'DateTime'), true),
      assert.equal(isValidValueForType('2016-05-19T17:09:24.12Z', 'DateTime'), true),
      assert.equal(isValidValueForType('2016-05-19T17:09:24.1234Z', 'DateTime'), true),

      assert.equal(isValidValueForType('2016-05-19T17:09:24.123Z', 'DateTime'), true),

      assert.equal(parseValue('2016-05-19T17:09:24.123Z', 'DateTime'), '2016-05-19T17:09:24.123Z')
    ])
  })
})
