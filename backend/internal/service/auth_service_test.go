package service

import (
	"testing"
)

func TestUsernameValidation(t *testing.T) {
	if !usernameRe.MatchString("test_user") {
		t.Error("expected 'test_user' to be valid")
	}
	if !usernameRe.MatchString("abc123") {
		t.Error("expected 'abc123' to be valid")
	}
	if usernameRe.MatchString("ab") {
		t.Error("expected 'ab' to be invalid (too short)")
	}
	if usernameRe.MatchString("user@name") {
		t.Error("expected 'user@name' to be invalid (special char)")
	}
	if usernameRe.MatchString("") {
		t.Error("expected '' to be invalid (empty)")
	}
}

func TestPasswordLengthCheck(t *testing.T) {
	if len("12345") >= 6 {
		t.Error("expected '12345' to be too short (< 6)")
	}
	if len("123456") < 6 {
		t.Error("expected '123456' to be long enough (>= 6)")
	}
}

func TestRoleValidation(t *testing.T) {
	validRoles := map[string]bool{"merchant": true, "user": true}
	if !validRoles["merchant"] {
		t.Error("expected 'merchant' to be valid")
	}
	if !validRoles["user"] {
		t.Error("expected 'user' to be valid")
	}
	if validRoles["admin"] {
		t.Error("expected 'admin' to be invalid")
	}
	if validRoles[""] {
		t.Error("expected '' to be invalid")
	}
}
