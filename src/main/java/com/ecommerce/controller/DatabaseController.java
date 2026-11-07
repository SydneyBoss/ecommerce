package com.ecommerce.controller;

import com.ecommerce.service.DatabaseService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/database")
@CrossOrigin(origins = "*")
public class DatabaseController {

    private final DatabaseService databaseService;

    @Autowired
    public DatabaseController(DatabaseService databaseService) {
        this.databaseService = databaseService;
    }

    /**
     * Get Database Engine & Connection Overview
     */
    @GetMapping("/overview")
    public ResponseEntity<Map<String, Object>> getDatabaseOverview() {
        return ResponseEntity.ok(databaseService.getDatabaseOverview());
    }

    /**
     * Get All Table Statistics (row counts, sizes, columns, keys)
     */
    @GetMapping("/tables")
    public ResponseEntity<List<Map<String, Object>>> getTableStatistics() {
        return ResponseEntity.ok(databaseService.getTableStatistics());
    }

    /**
     * Browse Table Records
     */
    @GetMapping("/tables/{tableName}/data")
    public ResponseEntity<?> getTableData(
            @PathVariable String tableName,
            @RequestParam(defaultValue = "50") int limit,
            @RequestParam(defaultValue = "0") int offset) {
        Map<String, Object> data = databaseService.getTableData(tableName, limit, offset);
        if (data.containsKey("error")) {
            return ResponseEntity.badRequest().body(data);
        }
        return ResponseEntity.ok(data);
    }

    /**
     * Execute Read-Only SQL Query
     */
    @PostMapping("/query")
    public ResponseEntity<?> executeQuery(@RequestBody Map<String, String> request) {
        String query = request.get("query");
        if (query == null || query.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Collections.singletonMap("error", "SQL query cannot be blank"));
        }
        Map<String, Object> result = databaseService.executeReadOnlyQuery(query);
        return ResponseEntity.ok(result);
    }
}
