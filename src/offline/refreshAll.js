import * as productsApi from '../api/products';
import * as suppliersApi from '../api/suppliers';
import * as customersApi from '../api/customers';
import * as branchesApi from '../api/branches';
import * as refundsApi from '../api/refunds';
import * as salesApi from '../api/sales';
import * as usersApi from '../api/users';
import * as auditsApi from '../api/audits';
import { setProducts } from '../store/productsSlice';
import { setSuppliers } from '../store/suppliersSlice';
import { setCustomers } from '../store/customersSlice';
import { setBranches } from '../store/branchesSlice';
import { setRequests } from '../store/refundsSlice';
import { setSales } from '../store/salesSlice';
import { setUsers } from '../store/usersSlice';
import { setEntries as setAuditEntries } from '../store/auditSlice';

export async function refreshAllData(dispatch) {
  const results = await Promise.allSettled([
    productsApi.list(),
    suppliersApi.list(),
    customersApi.list(),
    branchesApi.list(),
    refundsApi.listRequests(),
    salesApi.list(),
    usersApi.list(),
    auditsApi.list()
  ]);
  const [p, s, c, b, r, sl, u, au] = results;
  if (p.status === 'fulfilled' && Array.isArray(p.value)) dispatch(setProducts(p.value));
  if (s.status === 'fulfilled' && Array.isArray(s.value)) dispatch(setSuppliers(s.value));
  if (c.status === 'fulfilled' && Array.isArray(c.value)) dispatch(setCustomers(c.value));
  if (b.status === 'fulfilled' && Array.isArray(b.value) && b.value.length > 0) dispatch(setBranches(b.value));
  if (r.status === 'fulfilled' && Array.isArray(r.value)) dispatch(setRequests(r.value));
  if (sl.status === 'fulfilled' && Array.isArray(sl.value)) dispatch(setSales(sl.value));
  if (u.status === 'fulfilled' && Array.isArray(u.value)) dispatch(setUsers(u.value));
  if (au.status === 'fulfilled' && Array.isArray(au.value) && au.value.length > 0) dispatch(setAuditEntries(au.value));
}
