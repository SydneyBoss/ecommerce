package com.ecommerce.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Pattern;

@Service
public class DatabaseService {

    private final DataSource dataSource;
    private final JdbcTemplate jdbcTemplate;

    // Reject non-SELECT keywords to guarantee read-only query execution
    private static final Pattern DISALLOWED_SQL_PATTERN = Pattern.compile(
            "\\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE|GRANT|REVOKE|EXEC|EXECUTE|CALL|LOCK|MERGE)\\b",
            Pattern.CASE_INSENSITIVE
    );

    @Autowired
    public DatabaseService(DataSource dataSource, JdbcTemplate jdbcTemplate) {
        this.dataSource = dataSource;
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Gathers database overview metrics (engine, version, size, connections, uptime).
     */
    public Map<String, Object> getDatabaseOverview() {
        Map<String, Object> overview = new LinkedHashMap<>();

        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData metaData = conn.getMetaData();
            String productName = metaData.getDatabaseProductName();
            String productVersion = metaData.getDatabaseProductVersion();
            String url = metaData.getURL();
            String userName = metaData.getUserName();
            boolean isPostgres = productName != null && productName.toLowerCase().contains("postgres");

            overview.put("productName", productName);
            overview.put("productVersion", productVersion);
            overview.put("driverName", metaData.getDriverName());
            overview.put("driverVersion", metaData.getDriverVersion());
            overview.put("jdbcUrl", url);
            overview.put("userName", userName);
            overview.put("isPostgres", isPostgres);
            overview.put("status", "ONLINE");
            overview.put("timestamp", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));

            if (isPostgres) {
                try {
                    String dbName = jdbcTemplate.queryForObject("SELECT current_database()", String.class);
                    overview.put("databaseName", dbName != null ? dbName : "ecommercedb");
                } catch (Exception e) {
                    overview.put("databaseName", "ecommercedb");
                }

                try {
                    String fullVersion = jdbcTemplate.queryForObject("SELECT version()", String.class);
                    overview.put("fullVersion", fullVersion);
                } catch (Exception e) {
                    overview.put("fullVersion", productVersion);
                }

                try {
                    String dbSize = jdbcTemplate.queryForObject(
                            "SELECT pg_size_pretty(pg_database_size(current_database()))", String.class);
                    overview.put("databaseSize", dbSize);
                } catch (Exception e) {
                    overview.put("databaseSize", "Unknown");
                }

                try {
                    Integer connections = jdbcTemplate.queryForObject(
                            "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()", Integer.class);
                    overview.put("activeConnections", connections != null ? connections : 1);
                } catch (Exception e) {
                    overview.put("activeConnections", 1);
                }
            } else {
                overview.put("databaseName", "testdb (In-Memory)");
                overview.put("fullVersion", productVersion);
                overview.put("databaseSize", "In-Memory");
                overview.put("activeConnections", 1);
            }

        } catch (SQLException e) {
            overview.put("status", "ERROR");
            overview.put("error", e.getMessage());
        }

        return overview;
    }

    /**
     * Introspects all user tables, their row counts, disk sizes, columns, and primary keys.
     */
    public List<Map<String, Object>> getTableStatistics() {
        List<Map<String, Object>> tables = new ArrayList<>();

        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData metaData = conn.getMetaData();
            String productName = metaData.getDatabaseProductName();
            boolean isPostgres = productName != null && productName.toLowerCase().contains("postgres");
            String schema = isPostgres ? "public" : null;

            // Fetch table names
            List<String> tableNames = new ArrayList<>();
            try (ResultSet rs = metaData.getTables(null, schema, "%", new String[]{"TABLE"})) {
                while (rs.next()) {
                    String tbl = rs.getString("TABLE_NAME");
                    // Exclude internal flyway or liquibase tables if any
                    if (!tbl.startsWith("pg_") && !tbl.equalsIgnoreCase("schema_version")) {
                        tableNames.add(tbl);
                    }
                }
            }

            // Sort table names alphabetically
            Collections.sort(tableNames);

            for (String tableName : tableNames) {
                Map<String, Object> tableInfo = new LinkedHashMap<>();
                tableInfo.put("tableName", tableName);

                // Row Count
                try {
                    Long count = jdbcTemplate.queryForObject("SELECT count(*) FROM \"" + tableName + "\"", Long.class);
                    tableInfo.put("rowCount", count != null ? count : 0L);
                } catch (Exception ex) {
                    tableInfo.put("rowCount", 0L);
                }

                // PostgreSQL Size Metrics
                if (isPostgres) {
                    try {
                        String totalSize = jdbcTemplate.queryForObject(
                                "SELECT pg_size_pretty(pg_total_relation_size(?))", String.class, tableName);
                        String tableSize = jdbcTemplate.queryForObject(
                                "SELECT pg_size_pretty(pg_relation_size(?))", String.class, tableName);
                        String indexSize = jdbcTemplate.queryForObject(
                                "SELECT pg_size_pretty(pg_indexes_size(?))", String.class, tableName);

                        tableInfo.put("totalSize", totalSize != null ? totalSize : "0 bytes");
                        tableInfo.put("tableSize", tableSize != null ? tableSize : "0 bytes");
                        tableInfo.put("indexSize", indexSize != null ? indexSize : "0 bytes");
                    } catch (Exception e) {
                        tableInfo.put("totalSize", "N/A");
                        tableInfo.put("tableSize", "N/A");
                        tableInfo.put("indexSize", "N/A");
                    }
                } else {
                    tableInfo.put("totalSize", "In-Memory");
                    tableInfo.put("tableSize", "In-Memory");
                    tableInfo.put("indexSize", "In-Memory");
                }

                // Primary Key(s)
                Set<String> primaryKeys = new HashSet<>();
                try (ResultSet pkRs = metaData.getPrimaryKeys(null, schema, tableName)) {
                    while (pkRs.next()) {
                        primaryKeys.add(pkRs.getString("COLUMN_NAME"));
                    }
                } catch (Exception ignored) {}
                tableInfo.put("primaryKeys", new ArrayList<>(primaryKeys));

                // Column Details
                List<Map<String, Object>> columns = new ArrayList<>();
                try (ResultSet colRs = metaData.getColumns(null, schema, tableName, "%")) {
                    while (colRs.next()) {
                        Map<String, Object> col = new LinkedHashMap<>();
                        String colName = colRs.getString("COLUMN_NAME");
                        String typeName = colRs.getString("TYPE_NAME");
                        int columnSize = colRs.getInt("COLUMN_SIZE");
                        int decimalDigits = colRs.getInt("DECIMAL_DIGITS");
                        String isNullable = colRs.getString("IS_NULLABLE");
                        String colDef = colRs.getString("COLUMN_DEF");

                        col.put("name", colName);
                        col.put("type", formatColumnType(typeName, columnSize, decimalDigits));
                        col.put("rawType", typeName);
                        col.put("nullable", "YES".equalsIgnoreCase(isNullable));
                        col.put("defaultValue", colDef);
                        col.put("isPrimaryKey", primaryKeys.contains(colName));
                        columns.add(col);
                    }
                } catch (Exception ignored) {}

                tableInfo.put("columnCount", columns.size());
                tableInfo.put("columns", columns);
                tables.add(tableInfo);
            }

        } catch (SQLException e) {
            Map<String, Object> err = new HashMap<>();
            err.put("error", e.getMessage());
            tables.add(err);
        }

        return tables;
    }

    /**
     * Safely reads sample rows from a user-specified table.
     */
    public Map<String, Object> getTableData(String tableName, int limit, int offset) {
        Map<String, Object> result = new LinkedHashMap<>();

        // Validate table name against known tables
        List<String> validTables = getValidTableNames();
        String matchedTable = validTables.stream()
                .filter(t -> t.equalsIgnoreCase(tableName))
                .findFirst()
                .orElse(null);

        if (matchedTable == null) {
            result.put("error", "Table '" + tableName + "' not found in public database schema.");
            return result;
        }

        int safeLimit = Math.max(1, Math.min(limit, 200));
        int safeOffset = Math.max(0, offset);

        String countSql = "SELECT count(*) FROM \"" + matchedTable + "\"";
        Long totalRows = jdbcTemplate.queryForObject(countSql, Long.class);

        String selectSql = "SELECT * FROM \"" + matchedTable + "\" LIMIT " + safeLimit + " OFFSET " + safeOffset;
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(selectSql);

        List<String> columnNames = new ArrayList<>();
        if (!rows.isEmpty()) {
            columnNames.addAll(rows.get(0).keySet());
        } else {
            // Find columns from schema
            for (Map<String, Object> table : getTableStatistics()) {
                if (matchedTable.equalsIgnoreCase((String) table.get("tableName"))) {
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> cols = (List<Map<String, Object>>) table.get("columns");
                    if (cols != null) {
                        for (Map<String, Object> c : cols) {
                            columnNames.add((String) c.get("name"));
                        }
                    }
                }
            }
        }

        result.put("tableName", matchedTable);
        result.put("totalRows", totalRows != null ? totalRows : 0L);
        result.put("limit", safeLimit);
        result.put("offset", safeOffset);
        result.put("columns", columnNames);
        result.put("rows", rows);
        return result;
    }

    /**
     * Executes read-only queries (SELECT) and returns tabular results with execution metrics.
     */
    public Map<String, Object> executeReadOnlyQuery(String query) {
        Map<String, Object> response = new LinkedHashMap<>();

        if (query == null || query.trim().isEmpty()) {
            response.put("error", "Query cannot be empty.");
            return response;
        }

        String trimmed = query.trim();
        // Remove trailing semicolons
        while (trimmed.endsWith(";")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1).trim();
        }

        // Basic security check: must start with SELECT, EXPLAIN, or WITH
        String upper = trimmed.toUpperCase();
        if (!upper.startsWith("SELECT") && !upper.startsWith("EXPLAIN") && !upper.startsWith("WITH")) {
            response.put("error", "Only read-only queries (SELECT, EXPLAIN) are permitted in this console.");
            return response;
        }

        // Check for disallowed mutating keywords
        if (DISALLOWED_SQL_PATTERN.matcher(trimmed).find()) {
            response.put("error", "Modifying queries (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, etc.) are strictly prohibited.");
            return response;
        }

        // Append safe LIMIT if user did not specify one
        if (!upper.contains("LIMIT")) {
            trimmed += " LIMIT 100";
        }

        long start = System.currentTimeMillis();
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(trimmed);
            long duration = System.currentTimeMillis() - start;

            List<String> columns = rows.isEmpty() ? Collections.emptyList() : new ArrayList<>(rows.get(0).keySet());

            response.put("success", true);
            response.put("query", trimmed);
            response.put("executionTimeMs", duration);
            response.put("rowCount", rows.size());
            response.put("columns", columns);
            response.put("rows", rows);
        } catch (Exception ex) {
            response.put("success", false);
            response.put("error", ex.getMessage());
            response.put("executionTimeMs", System.currentTimeMillis() - start);
        }

        return response;
    }

    private List<String> getValidTableNames() {
        List<String> tables = new ArrayList<>();
        try (Connection conn = dataSource.getConnection()) {
            DatabaseMetaData metaData = conn.getMetaData();
            String schema = metaData.getDatabaseProductName().toLowerCase().contains("postgres") ? "public" : null;
            try (ResultSet rs = metaData.getTables(null, schema, "%", new String[]{"TABLE"})) {
                while (rs.next()) {
                    tables.add(rs.getString("TABLE_NAME"));
                }
            }
        } catch (SQLException ignored) {}
        return tables;
    }

    private String formatColumnType(String typeName, int size, int digits) {
        if (typeName == null) return "UNKNOWN";
        String lower = typeName.toLowerCase();
        if (lower.contains("char") || lower.contains("varchar")) {
            return size > 0 && size < 10000 ? typeName + "(" + size + ")" : typeName;
        }
        if (lower.contains("numeric") || lower.contains("decimal")) {
            return size > 0 ? typeName + "(" + size + (digits > 0 ? "," + digits : "") + ")" : typeName;
        }
        return typeName;
    }
}
