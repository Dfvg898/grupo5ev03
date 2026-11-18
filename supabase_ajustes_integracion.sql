-- Ajustes de permisos necesarios para que Recepción y el personal clínico
-- puedan consultar productos y registrar salidas/entradas de stock.
-- Ejecutar UNA sola vez en Supabase > SQL Editor, después del SQL principal.

-- Recepción necesita consultar productos para registrar ventas.
DROP POLICY IF EXISTS "productos_lectura_operativa" ON public.productos;
CREATE POLICY "productos_lectura_operativa"
ON public.productos
FOR SELECT
TO authenticated
USING (public.rol_actual() = ANY (ARRAY['Administrador','Veterinario','Recepcionista','Asistente']::text[]));

-- La edición del catálogo (INSERT/DELETE) sigue reservada al Administrador.
-- Estos roles solo necesitan actualizar stock en las operaciones existentes.
DROP POLICY IF EXISTS "productos_actualizar_stock_operativo" ON public.productos;
CREATE POLICY "productos_actualizar_stock_operativo"
ON public.productos
FOR UPDATE
TO authenticated
USING (public.rol_actual() = ANY (ARRAY['Administrador','Veterinario','Recepcionista','Asistente']::text[]))
WITH CHECK (public.rol_actual() = ANY (ARRAY['Administrador','Veterinario','Recepcionista','Asistente']::text[]));

-- Ventas de recepción y aplicaciones clínicas generan movimientos de inventario.
DROP POLICY IF EXISTS "movimientos_stock_lectura_operativa" ON public.movimientos_stock;
CREATE POLICY "movimientos_stock_lectura_operativa"
ON public.movimientos_stock
FOR SELECT
TO authenticated
USING (public.rol_actual() = ANY (ARRAY['Administrador','Veterinario','Recepcionista','Asistente']::text[]));

DROP POLICY IF EXISTS "movimientos_stock_insertar_operativo" ON public.movimientos_stock;
CREATE POLICY "movimientos_stock_insertar_operativo"
ON public.movimientos_stock
FOR INSERT
TO authenticated
WITH CHECK (public.rol_actual() = ANY (ARRAY['Administrador','Veterinario','Recepcionista','Asistente']::text[]));

-- Limita los permisos de UPDATE de productos a la columna stock.
-- La app actual no ofrece edición de SKU/nombre/precio desde roles operativos.
REVOKE UPDATE ON public.productos FROM authenticated;
GRANT UPDATE (stock) ON public.productos TO authenticated;
