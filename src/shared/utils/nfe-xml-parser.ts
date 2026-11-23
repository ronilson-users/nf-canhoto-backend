import { XMLParser } from 'fast-xml-parser';
import { extractNfe, NfeXmlError, type NfeXmlData } from './nfe-xml';

// parseTagValue:false mantém tudo como string (CNPJ, IE e nNF não perdem zeros à esquerda)
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => name === 'det' || name === 'dup' || name === 'detPag' || name === 'vol',
});

export const parseNfeXml = (xml: string): NfeXmlData => {
  // não processamos DTD/entidades (evita XXE e "billion laughs")
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new NfeXmlError('XML com DOCTYPE/ENTITY não é aceito');

  let obj: unknown;
  try {
    obj = parser.parse(xml);
  } catch {
    throw new NfeXmlError('XML malformado');
  }
  return extractNfe(obj);
};
