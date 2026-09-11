FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src

COPY global.json ./
COPY src/RequestHub.Domain/RequestHub.Domain.csproj src/RequestHub.Domain/
COPY src/RequestHub.Application/RequestHub.Application.csproj src/RequestHub.Application/
COPY src/RequestHub.Infrastructure/RequestHub.Infrastructure.csproj src/RequestHub.Infrastructure/
COPY src/RequestHub.Api/RequestHub.Api.csproj src/RequestHub.Api/
RUN dotnet restore src/RequestHub.Api/RequestHub.Api.csproj

COPY src/ src/
RUN dotnet publish src/RequestHub.Api/RequestHub.Api.csproj -c Release --no-restore -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
COPY --from=build /app ./
USER $APP_UID
ENTRYPOINT ["dotnet", "RequestHub.Api.dll"]
