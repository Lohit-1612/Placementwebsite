package com.placeprep;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
class Security {
  @Bean
  SecurityFilterChain chain(HttpSecurity http) throws Exception {
    return http.csrf(c -> c.disable())
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            a ->
                a.requestMatchers(
                        "/actuator/health", "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .oauth2ResourceServer(o -> o.jwt(j -> {}))
        .build();
  }

  @Bean
  JwtDecoder decoder(
      @Value("${spring.security.oauth2.resourceserver.jwt.jwk-set-uri}") String jwks,
      @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}") String issuer) {
    var decoder = NimbusJwtDecoder.withJwkSetUri(jwks).build();
    OAuth2TokenValidator<Jwt> audience =
        jwt ->
            jwt.getAudience().contains("placeprep-api")
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(
                    new OAuth2Error("invalid_token", "Invalid audience", null));
    decoder.setJwtValidator(
        new DelegatingOAuth2TokenValidator<>(
            JwtValidators.createDefaultWithIssuer(issuer), audience));
    return decoder;
  }
}
