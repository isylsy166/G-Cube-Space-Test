package test.gcube.service;

import java.util.Optional;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import test.gcube.entity.RequestLog;
import test.gcube.repository.RequestLogRepository;

/**
 * 같은 요청이 여러 번 와도 한 번만 반영되게 막는다.
 *
 * <p>발주 생성과 입고 처리는 "같은 수량을 또 넣는 것"이 업무적으로 정상일 수 있어
 * 상태만으로는 중복을 구분할 수 없다. 그래서 호출자가 준 멱등 키를 저장해 두고,
 * 같은 키가 다시 오면 처음 처리한 결과를 그대로 돌려준다.
 *
 * <p>중복을 실제로 막는 것은 {@code request_log} 의 UNIQUE 제약이다. 동시에 같은 키로
 * 두 요청이 들어오면 둘 중 하나는 제약에 걸려 실패하고, 그 요청은 먼저 저장된 결과를 읽는다.
 */
@Component
@RequiredArgsConstructor
public class IdempotencyGuard {

    private final RequestLogRepository requestLogRepository;

    /** 이미 처리된 키면 그때의 결과 식별값을 준다. */
    public Optional<String> findResult(String key) {
        if (key == null || key.isBlank()) {
            return Optional.empty();
        }
        return requestLogRepository.findByIdempotencyKey(key).map(RequestLog::getResultCode);
    }

    /**
     * 이미 처리한 키면 그 결과를 돌려주고, 아니면 한 번만 실행한다.
     *
     * <p>작업을 먼저 실행하고 키를 나중에 저장한다. 결과 식별값(문서번호)이 작업을 해 봐야
     * 나오기 때문이다. 같은 키가 동시에 들어와 저장이 UNIQUE 제약에 걸리면 예외를 던지는데,
     * 그러면 같은 트랜잭션에서 실행된 작업도 함께 롤백된다. 즉 **키 저장에 실패한 요청은
     * 부수효과도 남기지 않는다.** 선점 방식이 아니어도 중복이 반영되지 않는 이유가 여기에 있다.
     *
     * @param work 실제 처리. 결과 식별값(문서번호 등)을 돌려줘야 한다.
     */
    public String runOnce(String key, String requestType, Supplier<String> work) {
        if (key == null || key.isBlank()) {
            return work.get(); // 키가 없으면 멱등 보장 없이 그대로 처리한다
        }
        Optional<String> done = findResult(key);
        if (done.isPresent()) {
            return done.get();
        }
        String resultCode = work.get();
        try {
            requestLogRepository.saveAndFlush(RequestLog.builder()
                    .idempotencyKey(key)
                    .requestType(requestType)
                    .resultCode(resultCode)
                    .build());
        } catch (DataIntegrityViolationException e) {
            // 동시에 같은 키가 들어온 경우. 먼저 저장된 결과를 따른다.
            throw new IllegalStateException(
                    "같은 요청이 이미 처리 중입니다. 잠시 후 결과를 다시 조회해 주세요.", e);
        }
        return resultCode;
    }
}
