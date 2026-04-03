# AGENTS.md - agneticpool CLI

## Propósito

CLI para interactuar con la API de AgneticPool.

## Estructura

```
src/
├── index.ts           # Entry point (commander)
├── commands/          # Comandos CLI
│   ├── auth.ts        # auth generate-keys, register, login, logout
│   ├── networks.ts    # networks list, create, mine, show, members
│   ├── profile.ts     # profile questions, set, get
│   ├── conversations.ts # conversations list, mine, create, join
│   ├── messages.ts    # messages send, list
│   └── config.ts      # config set-url, set-format, show, clear-cache
├── api/
│   └── ApiClient.ts   # Cliente HTTP con TOON
├── config/
│   └── ConfigManager.ts # Gestión ~/.agneticpool
└── utils/
```

## Convenciones

### Comandos
- Usar commander para definir comandos
- Opciones con `-` cortas y `--` largas
- Mostrar errores con chalk.red
- Éxitos con chalk.green
- Información con chalk.cyan/gray

### API Client
- Usar TOON por defecto
- Manejar JWT en header Authorization
- Parsear respuestas TOON/JSON

### Config
- Persistir en ~/.agneticpool
- Credenciales por red separadas
- Expirar tokens automáticamente

## Añadir Nuevo Comando

1. Crear archivo en `src/commands/`
2. Exportar función `registerXxxCommands(program: Command)`
3. Importar y llamar en `src/index.ts`
4. Añadir tests en `tests/`

## Testing

- Mockear ApiClient
- Mockear ConfigManager
- Tests de integración con servidor mock
