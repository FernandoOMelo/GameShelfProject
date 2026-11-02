/// Deslocamento do fuso no formato que a API espera (`timezoneOffsetMinutes`):
/// o mesmo sinal de `Date.getTimezoneOffset()` do JavaScript, ou seja, UTC menos
/// o horário local. No Brasil (UTC-3) é +180; o `timeZoneOffset` do Dart tem o
/// sinal contrário (-180), por isso a inversão.
int apiTimezoneOffsetMinutes([DateTime? now]) => -(now ?? DateTime.now()).timeZoneOffset.inMinutes;
