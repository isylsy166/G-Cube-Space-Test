package test.gcube.global.exception;

import java.util.NoSuchElementException;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** API 공통 예외 처리. 담당자가 읽을 수 있는 한글 사유를 그대로 내려 준다. */
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(NoSuchElementException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ErrorResponse(e.getMessage()));
    }

    /**
     * 업무 규칙 위반. 요청 형식이 아니라 그 시점의 재고·문서 상태 때문에 거절된 것이므로
     * 400 이 아니라 409 로 돌려준다. 담당자는 사유를 읽고 무엇을 먼저 처리할지 판단한다.
     */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> handleBusinessRule(IllegalStateException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ErrorResponse(e.getMessage()));
    }

    /**
     * 같은 재고를 동시에 잡다가 DB 가 한쪽을 되돌린 경우(데드락·락 대기 초과).
     *
     * <p>락 순서를 품목코드로 고정해 두어 정상 흐름에서는 거의 나지 않지만, 나더라도
     * 영문 스택이 그대로 나가면 담당자가 읽을 수 없다. 이 요청은 통째로 롤백되었으므로
     * 숫자는 어긋나지 않았고, 다시 시도하면 되는 상황이라 그렇게 안내한다.
     */
    @ExceptionHandler({PessimisticLockingFailureException.class, CannotAcquireLockException.class})
    public ResponseEntity<ErrorResponse> handleLockFailure(RuntimeException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ErrorResponse(
                        "다른 처리가 같은 재고를 먼저 잡고 있습니다. 이 요청은 반영되지 않았으니 "
                                + "잠시 후 다시 시도해 주세요."));
    }

    public record ErrorResponse(String message) {
    }
}
