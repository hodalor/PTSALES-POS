import * as productsApi from '../api/products';
import { setProducts } from '../store/productsSlice';

export async function refreshProductCatalog(dispatch) {
  const rows = await productsApi.list();
  if (Array.isArray(rows)) dispatch(setProducts(rows));
  return rows;
}
