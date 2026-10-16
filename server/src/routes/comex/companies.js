import { Router } from 'express';
import { AppError } from '../../utils/errors.js';
import { bodyObject, integerId, lengthString, optionalEmail, optionalLengthString, rolesList } from '../../utils/validate.js';
import { requirePermission } from '../../middleware/session.js';
import { parseRoles } from '../../services/permissions.js';
import { audit } from '../../services/audit.js';

export const COMPANY_ROLES = ['MOLINO', 'COMPRADOR', 'EXPORTADOR', 'INTERMEDIARIO'];
const EDITABLE = ['name', 'taxId', 'country', 'province', 'roles', 'notes'];
const withContacts = { contacts: { orderBy: { id: 'asc' } } };

function companyFields(b, partial) {
  const unknown = Object.keys(b).filter(k => !EDITABLE.includes(k));
  if (unknown.length) throw new AppError('VALIDATION_ERROR', `Campos no editables: ${unknown.join(', ')}`);
  const data = {};
  const has = k => !partial || b[k] !== undefined;
  if (has('name')) data.name = lengthString(b.name, 'name', 2, 120);
  if (has('country')) data.country = lengthString(b.country, 'country', 2, 60);
  if (has('roles')) data.roles = rolesList(b.roles, 'roles', COMPANY_ROLES).join(',');
  if (has('taxId')) data.taxId = optionalLengthString(b.taxId, 'taxId', 2, 40);
  if (has('province')) data.province = optionalLengthString(b.province, 'province', 2, 60);
  if (has('notes')) data.notes = optionalLengthString(b.notes, 'notes', 1, 2000);
  return data;
}

function contactFields(b) {
  return { name: lengthString(b.name, 'name', 2, 120), email: optionalEmail(b.email, 'email'), phone: optionalLengthString(b.phone, 'phone', 3, 40), position: optionalLengthString(b.position, 'position', 2, 80) };
}

export function serializeCompany(c) {
  return { id: c.id, name: c.name, taxId: c.taxId, country: c.country, province: c.province, roles: parseRoles(c.roles), notes: c.notes, createdAt: c.createdAt, updatedAt: c.updatedAt, contacts: (c.contacts || []).map(({ companyId: _companyId, ...contact }) => contact) };
}

async function findCompany(prisma, id) {
  const company = await prisma.company.findUnique({ where: { id }, include: withContacts });
  if (!company) throw new AppError('NOT_FOUND', 'Empresa no encontrada', 404);
  return company;
}

export function companiesRouter(prisma) {
  const router = Router();

  router.get('/companies', requirePermission('companies:read'), async (req, res, next) => { try {
    const role = typeof req.query.role === 'string' && req.query.role ? req.query.role.toUpperCase() : null;
    if (role && !COMPANY_ROLES.includes(role)) throw new AppError('VALIDATION_ERROR', `role debe ser uno de: ${COMPANY_ROLES.join(', ')}`);
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : '';
    const where = {};
    if (role) where.roles = { contains: role };
    if (q) where.OR = [{ name: { contains: q } }, { taxId: { contains: q } }];
    const companies = await prisma.company.findMany({ where, include: withContacts, orderBy: { name: 'asc' } });
    res.json(companies.filter(c => !role || parseRoles(c.roles).includes(role)).map(serializeCompany));
  } catch (e) { next(e); } });

  router.get('/companies/:id', requirePermission('companies:read'), async (req, res, next) => { try {
    res.json(serializeCompany(await findCompany(prisma, integerId(req.params.id, 'id'))));
  } catch (e) { next(e); } });

  router.post('/companies', requirePermission('companies:write'), async (req, res, next) => { try {
    const data = companyFields(bodyObject(req.body), false);
    const company = await prisma.$transaction(async tx => {
      const created = await tx.company.create({ data, include: withContacts });
      await audit(tx, req.user.id, 'company.create', 'Company', created.id, data);
      return created;
    });
    res.status(201).json(serializeCompany(company));
  } catch (e) { next(e); } });

  router.patch('/companies/:id', requirePermission('companies:write'), async (req, res, next) => { try {
    const id = integerId(req.params.id, 'id');
    const data = companyFields(bodyObject(req.body), true);
    const before = await findCompany(prisma, id);
    const changes = Object.fromEntries(Object.entries(data).filter(([k, v]) => before[k] !== v).map(([k, v]) => [k, { from: before[k], to: v }]));
    const company = await prisma.$transaction(async tx => {
      const updated = await tx.company.update({ where: { id }, data, include: withContacts });
      await audit(tx, req.user.id, 'company.update', 'Company', id, changes);
      return updated;
    });
    res.json(serializeCompany(company));
  } catch (e) { next(e); } });

  router.post('/companies/:id/contacts', requirePermission('companies:write'), async (req, res, next) => { try {
    const companyId = integerId(req.params.id, 'id');
    const data = contactFields(bodyObject(req.body));
    await findCompany(prisma, companyId);
    const contact = await prisma.$transaction(async tx => {
      const created = await tx.companyContact.create({ data: { ...data, companyId } });
      await audit(tx, req.user.id, 'contact.create', 'CompanyContact', created.id, { companyId, ...data });
      return created;
    });
    res.status(201).json(contact);
  } catch (e) { next(e); } });

  router.delete('/contacts/:id', requirePermission('companies:write'), async (req, res, next) => { try {
    const id = integerId(req.params.id, 'id');
    const contact = await prisma.companyContact.findUnique({ where: { id } });
    if (!contact) throw new AppError('NOT_FOUND', 'Contacto no encontrado', 404);
    await prisma.$transaction(async tx => {
      await tx.companyContact.delete({ where: { id } });
      await audit(tx, req.user.id, 'contact.delete', 'CompanyContact', id, contact);
    });
    res.status(204).end();
  } catch (e) { next(e); } });

  router.patch('/lots/:id/supplier', requirePermission('lots:link'), async (req, res, next) => { try {
    const id = integerId(req.params.id, 'id');
    bodyObject(req.body);
    const supplierCompanyId = req.body.supplierCompanyId === null ? null : integerId(req.body.supplierCompanyId, 'supplierCompanyId');
    const lot = await prisma.lot.findUnique({ where: { id } });
    if (!lot) throw new AppError('NOT_FOUND', 'Lote no encontrado', 404);
    let supplier = null;
    if (supplierCompanyId !== null) {
      supplier = await prisma.company.findUnique({ where: { id: supplierCompanyId } });
      if (!supplier) throw new AppError('NOT_FOUND', 'Empresa no encontrada', 404);
      if (!parseRoles(supplier.roles).includes('MOLINO')) throw new AppError('VALIDATION_ERROR', 'La empresa proveedora debe tener rol MOLINO');
    }
    await prisma.$transaction(async tx => {
      await tx.lot.update({ where: { id }, data: { supplierCompanyId } });
      await audit(tx, req.user.id, 'lot.link_supplier', 'Lot', id, { from: lot.supplierCompanyId, to: supplierCompanyId });
    });
    res.json({ lotId: id, supplier: supplier ? { id: supplier.id, name: supplier.name } : null });
  } catch (e) { next(e); } });

  return router;
}
