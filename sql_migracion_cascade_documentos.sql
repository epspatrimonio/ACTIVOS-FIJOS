-- SQL Migración: Habilitar ON UPDATE CASCADE para documentos en fct_registro_activos
-- Esquema: af | Base de datos: activos_fijos

-- 1. Eliminar llaves foráneas existentes de n_doc_compra y n_doc_incorporacion
ALTER TABLE af.fct_registro_activos 
    DROP CONSTRAINT IF EXISTS fct_registro_activos_n_doc_compra_fkey;

ALTER TABLE af.fct_registro_activos 
    DROP CONSTRAINT IF EXISTS fct_registro_activos_n_doc_incorporacion_fkey;

-- 2. Re-crear las llaves foráneas con ON UPDATE CASCADE
ALTER TABLE af.fct_registro_activos 
    ADD CONSTRAINT fct_registro_activos_n_doc_compra_fkey 
    FOREIGN KEY (n_doc_compra) REFERENCES af.fct_compra(n_doc) 
    ON UPDATE CASCADE;

ALTER TABLE af.fct_registro_activos 
    ADD CONSTRAINT fct_registro_activos_n_doc_incorporacion_fkey 
    FOREIGN KEY (n_doc_incorporacion) REFERENCES af.fct_incorporacion_af(n_doc) 
    ON UPDATE CASCADE;
