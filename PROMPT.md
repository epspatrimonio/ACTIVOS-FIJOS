**ROL** : Actúa como un **Arquitecto de Software, Especialista en Bases de Datos Relacionales y Consultor Funcional en Sistemas de Gestión de Bienes Patrimoniales y Activos Fijos** . 

El APP activos fijos y su sincronización con el dashboard son funcionales. Se requiere que el diseño se expanda sobre esa base funcional, por lo que analiza la información para adaptarlo al sistema existente. 

La implementación debe estar orientado a: 

- Análisis de datos. 

- Homologación de información. 

- Diseño de estructuras complementarias. 

- Reglas de negocio. 

- Trazabilidad de cambios. 

- Control de calidad de datos. 

- Integración con la base de datos existente. 

- Seguridad y recuperación ante errores. 

# **CONTEXTO FUNCIONAL** 

La aplicación APP Activos Fijos cuenta actualmente con dos carpetas de información: 

1. Inventario Físico. 

2. Inventario Sistema. 

En esta etapa del proyecto se trabajará exclusivamente con la carpeta **Inventario Físico** . 

No se requiere efectuar aún procesos de conciliación con el Inventario Sistema ni realizar cruces con información contable. 

# **SITUACIÓN ACTUAL** 

La carpeta Inventario Físico contiene archivos Excel del levantamiento físico del inventario de los activos fijos de las distintas localidades, sucursales. 

La estructura de estos archivos coincide parcialmente con la estructura de datos utilizada por el sistema de Activos Fijos. 

Asimismo: 

- Existen bienes que cuentan con código patrimonial y otros no. 

- Existen bienes con el número de código incompleto de 9 dígitos y otros repetidos 

- Existen bienes cuya naturaleza patrimonial aún debe determinarse. 

- Todo bien que no cuente con código patrimonial deberá ser considerado como un bien sobrante hasta que concluya el proceso de evaluación y regularización. 

- La información requiere revisión, homologación, normalización y depuración antes de incorporarse al sistema. 

# **OBJETIVO DE ESTA ETAPA** 

Antes de realizar cualquier incorporación de datos al sistema, se requiere analizar integralmente la información contenida en la carpeta Inventario Físico para determinar su calidad, consistencia y compatibilidad con la estructura del sistema actual. 

# **ACTIVIDADES REQUERIDAS** 

# **1. Análisis estructural de los archivos** 

Analizar todos los archivos de la carpeta Inventario Físico e identificar: 

- Estructura de cada archivo. 

- Campos existentes. 

- Campos repetidos. 

- Campos faltantes. 

- Formatos inconsistentes. 

- Calidad de la información. 

- Posibles problemas de carga o migración. 

Analiza los campos para adaptar y modificar la estructura de los datos del Excel conforme a la estructura de campos del sistema de activos fijos. 

# **2. Homologación de información** 

Realizar un proceso de mapeo entre los campos identificados en los archivos Excel y los campos existentes en el módulo de Activos Fijos. 

El objetivo es que toda la información proveniente del inventario físico adopte la misma estructura de datos utilizada actualmente por el sistema patrimonial Activos Fijos. 

La homologación deberá identificar: 

- Campos equivalentes. 

- Campos nuevos. 

- Campos inexistentes. 

- Campos que requieren transformación. 

- Campos que requieren reglas especiales de validación. 

# **3. Normalización de datos** 

Estandarizar la información de acuerdo con la estructura utilizada por los Activos Fijos. Asimismo, identificar información inconsistente, incompleta o que requiera corrección. 

# **4. Identificación de registros especiales** 

Adicionar campos en el Excel orientado a observaciones a fin de filtrar para revisión. 

# **Duplicados, número de código incompleto.** 

# **Bienes que requieren regularización** 

Identificar bienes con información insuficiente para determinar su situación patrimonial. 

# **Vehículos** 

Identificar vehículos que: 

- No cuentan con Orden de Compra. 

- No cuentan con documento de transferencia. 

- No cuentan con registro de Obra en Curso. 

Los vehículos, así como activos fijos con Orden de Compra de código **OC-0000000** deben pasar a los registros de sobrantes de la pestaña REGULARIZACIÓN. Los bienes que se encuentren como faltante o sobrante deberán ir en una pestaña de REGULARIZACIÓN, que es donde irán los datos de los archivos de Excel de la carpeta de inventario físico. 

# **Requerimiento funcional** 

Crear dentro de APP Activos Fijos una nueva pestaña denominada: 

# **REGULARIZACIÓN** 

Esta pestaña funcionará como una tabla para almacenar la información proveniente del inventario físico ya homologada y normalizada correspondiente a bienes sobrantes y faltantes y si tienen código patrimonial y no cuentan con orden de compra serán clasificados como conciliación. Adicionalmente, irán terceros y control. Estas sub pestañas corresponden al registro de bienes de terceros y control a bienes de la empresa que no son activos fijos pero que requieren ser controlados. 

Pestaña REGULARIZACIÓN, dentro conciliación, sobrantes, faltantes, terceros y control. 

# **Características de la pestaña REGULARIZACIÓN** 

La estructura deberá utilizar los mismos campos existentes en la tabla de Activos Fijos para garantizar compatibilidad con futuras migraciones. 

Las tablas de bienes sobrantes tienen un registro básico, principalmente de los datos del activo fijo que no están sujeto a un responsable. Los faltantes corresponden a los bienes no identificados en el inventario, pero que sí existen, estos deberían estar en el sistema, pero solo en el inventario se registra que no se ha identificado, es decir que ya tiene registro en el sistema solo que no está físicamente. Ya existe una tabla de bienes de terceros que se puede mantener y los bienes de control son como los bienes sobrantes pero cuentan con un responsable. 

# **Reglas de negocio** 

# **Regla 1: Código patrimonial** 

Si el bien posee código patrimonial: 

- Debe conservarse el código original. 

- No debe generarse un nuevo código. 

- Si se detecta duplicidad, deberá marcarse como observado. 

- No debe modificarse automáticamente. 

# **Regla 2: Bienes sin código patrimonial** 

Si el bien no posee código patrimonial: 

- Deberá clasificarse inicialmente como SOBRANTE. 

- Deberá asignarse automáticamente un código patrimonial autogenerado 

- Su situación deberá evaluarse posteriormente. 

En caso que se vaya a incorporar el bien, el bien debe ser revaluado para determinar su monto. 

# **Regla 3: Vehículos** 

Los vehículos que no cuenten con: 

- Orden de Compra. 

- Transferencia. 

- Obra en Curso. 

Los vehículos registrados pasarán a la pestaña Conciliación (Considera que los vehículos registrados cuentan con código patrimoniales y deben mantener la integridad de sus datos para la gestión en la pestaña vehículos – SOAT & RT 

# **Regla 4: Integridad de datos** 

Ningún proceso de homologación, normalización o migración podrá modificar los archivos fuente originales, deberá mantener la integridad y funcionalidad como actualmente viene funcionando. 

# **Trazabilidad** 

Todo cambio efectuado sobre los registros deberá quedar registrado en una bitácora de auditoría. 

Como mínimo deberá almacenar: 

- Fecha y hora. 

- Usuario. 

- Campo modificado. 

- Valor anterior. 

- Valor nuevo. 

- Motivo u observación. 

- Tipo de modificación. 

# **Seguridad y recuperación** 

Debido a que se realizará un proceso masivo de análisis y transformación de datos, la solución deberá contemplar mecanismos de recuperación. 

Antes de cualquier carga o modificación se deberá: 

- Generar un respaldo completo de la base de datos. 

- Generar respaldo de los archivos fuente. 

- Permitir reversión de cambios. 

- Permitir restauración al estado inicial. 

- Mantener versiones de las cargas realizadas. 

- Registrar fecha, usuario y lote de importación. 

# **Resultado esperado** 

Presenta una propuesta técnica y funcional que incluya: 

# **A. Diagnóstico de la información** 

- Calidad de datos. 

- Estructura detectada. 

- Observaciones. 

- Riesgos identificados. 

# **B. Diseño de la tabla FÍSICO** 

# **C. Reglas de homologación** 

Definir la correspondencia entre: 

- Campos de los archivos Excel. 

- Campos de la tabla Activos Fijos. 

- Campos de la nueva tabla FÍSICO. 

# **D. Reglas de calidad de datos** 

Definir controles para: 

- Duplicados. 

- Inconsistencias. 

- Datos obligatorios. 

- Datos opcionales. 

- Valores nulos. 

- Formatos inválidos. 

# **E. Modelo de almacenamiento** 

Diseñar las tablas complementarias necesarias para almacenar: 

- Estados de regularización. 

- Observaciones. 

- Historial de cambios. 

- Bitácora de auditoría. 

- Lotes de importación. 

La propuesta deberá integrarse a la base de datos existente sin afectar los módulos actualmente operativos. 

